-- Stage 18. Local validation only; production requires separate approval.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $recovery_precheck$
DECLARE
  source_table regclass;
  source_name text;
  missing text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Checkout recovery precheck: expected postgres owner';
  END IF;
  IF to_regclass('public.ecommerce_checkout_recovery') IS NOT NULL
    OR to_regclass('public.ecommerce_checkout_recovery_admin') IS NOT NULL
    OR to_regprocedure('public.ecommerce_record_checkout_recovery(text,bigint,text,text,boolean,text,jsonb,bigint,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Checkout recovery precheck: existing or partial installation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role' AND rolbypassrls)
    OR NOT has_schema_privilege('service_role', 'public', 'USAGE')
    OR pg_has_role('anon', 'service_role', 'MEMBER')
    OR pg_has_role('authenticated', 'service_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Checkout recovery precheck: unexpected application privileges';
  END IF;
  FOR source_name IN SELECT unnest(ARRAY['ecommerce_orders','ecommerce_payment_attempts'])
  LOOP
    source_table := to_regclass('public.' || source_name);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = source_table AND relkind = 'r'
      AND relrowsecurity AND pg_get_userbyid(relowner) = 'postgres') THEN
      RAISE EXCEPTION 'Checkout recovery precheck: missing or incompatible source %', source_name;
    END IF;
  END LOOP;
  SELECT string_agg(e.tbl || '.' || e.col, ', ') INTO missing
  FROM (VALUES
    ('ecommerce_orders','id','uuid'::regtype), ('ecommerce_orders','order_number','text'::regtype),
    ('ecommerce_orders','checkout_idempotency_key','text'::regtype), ('ecommerce_orders','customer_phone','text'::regtype),
    ('ecommerce_orders','payment_status','text'::regtype), ('ecommerce_orders','order_status','text'::regtype),
    ('ecommerce_orders','created_at','timestamptz'::regtype), ('ecommerce_orders','store_id','text'::regtype),
    ('ecommerce_payment_attempts','order_id','uuid'::regtype), ('ecommerce_payment_attempts','checkout_url','text'::regtype),
    ('ecommerce_payment_attempts','provider_checkout_id','text'::regtype)
  ) AS e(tbl,col,typ)
  LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = to_regclass('public.' || e.tbl)
    AND a.attname = e.col AND NOT a.attisdropped
  WHERE a.atttypid IS DISTINCT FROM e.typ::oid
    OR NOT has_column_privilege('service_role', a.attrelid, a.attnum, 'SELECT');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Checkout recovery precheck: missing, incompatible or unreadable source columns: %', missing;
  END IF;
  -- Existing triggers belong to the financial flow. This release only reads those tables.
  -- The table/view/function above must not exist, including any target triggers or grants.
END;
$recovery_precheck$;

CREATE TABLE public.ecommerce_checkout_recovery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  customer_phone text NOT NULL CHECK (customer_phone ~ '^[0-9]{10,11}$'),
  customer_name text CHECK (char_length(customer_name) BETWEEN 1 AND 160),
  contact_allowed boolean NOT NULL DEFAULT false,
  delivery_method text NOT NULL CHECK (delivery_method IN ('pickup','shipping')),
  cart_items jsonb NOT NULL CHECK (jsonb_typeof(cart_items) = 'array' AND jsonb_array_length(cart_items) <= 50),
  subtotal_cents bigint NOT NULL CHECK (subtotal_cents BETWEEN 0 AND 9007199254740991),
  checkout_request_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(checkout_request_ids) <= 8),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ignored_at timestamptz
);
CREATE INDEX ecommerce_checkout_recovery_activity_idx ON public.ecommerce_checkout_recovery (last_activity_at DESC, id DESC);
ALTER TABLE public.ecommerce_checkout_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ecommerce_checkout_recovery FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE (ignored_at) ON public.ecommerce_checkout_recovery TO service_role;

CREATE FUNCTION public.ecommerce_record_checkout_recovery(
  p_token_hash text, p_revision bigint, p_phone text, p_name text, p_contact_allowed boolean,
  p_delivery text, p_items jsonb, p_subtotal bigint, p_request_id uuid
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $record$
  INSERT INTO public.ecommerce_checkout_recovery AS r (
    token_hash, revision, customer_phone, customer_name, contact_allowed, delivery_method,
    cart_items, subtotal_cents, checkout_request_ids
  ) SELECT p_token_hash, p_revision, p_phone, p_name, p_contact_allowed, p_delivery, p_items, p_subtotal,
    CASE WHEN p_request_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[p_request_id] END
  WHERE p_items <> '[]'::jsonb OR EXISTS (
    SELECT 1 FROM public.ecommerce_checkout_recovery WHERE token_hash = p_token_hash)
  ON CONFLICT (token_hash) DO UPDATE SET
    revision = greatest(r.revision, excluded.revision),
    customer_name = CASE WHEN excluded.revision > r.revision THEN excluded.customer_name ELSE r.customer_name END,
    contact_allowed = CASE WHEN excluded.revision > r.revision THEN excluded.contact_allowed ELSE r.contact_allowed END,
    delivery_method = CASE WHEN excluded.revision > r.revision THEN excluded.delivery_method ELSE r.delivery_method END,
    cart_items = CASE WHEN excluded.revision > r.revision THEN excluded.cart_items ELSE r.cart_items END,
    subtotal_cents = CASE WHEN excluded.revision > r.revision THEN excluded.subtotal_cents ELSE r.subtotal_cents END,
    checkout_request_ids = CASE WHEN p_request_id IS NOT NULL AND NOT p_request_id = ANY(r.checkout_request_ids)
      AND cardinality(r.checkout_request_ids) < 8 THEN array_append(r.checkout_request_ids, p_request_id) ELSE r.checkout_request_ids END,
    last_activity_at = CASE WHEN (excluded.revision > r.revision AND ROW(r.customer_name, r.contact_allowed, r.delivery_method, r.cart_items)
      IS DISTINCT FROM ROW(excluded.customer_name, excluded.contact_allowed, excluded.delivery_method, excluded.cart_items))
      OR (p_request_id IS NOT NULL AND NOT p_request_id = ANY(r.checkout_request_ids) AND cardinality(r.checkout_request_ids) < 8)
      THEN clock_timestamp() ELSE r.last_activity_at END
  WHERE r.expires_at > now() AND r.customer_phone = excluded.customer_phone
$record$;
REVOKE ALL ON FUNCTION public.ecommerce_record_checkout_recovery(text,bigint,text,text,boolean,text,jsonb,bigint,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ecommerce_record_checkout_recovery(text,bigint,text,text,boolean,text,jsonb,bigint,uuid)
  TO service_role;

CREATE VIEW public.ecommerce_checkout_recovery_admin WITH (security_invoker = true) AS
SELECT r.id, r.last_activity_at, r.expires_at, r.subtotal_cents, r.delivery_method,
  CASE WHEN r.expires_at > now() THEN r.customer_name END AS customer_name,
  CASE WHEN r.expires_at > now() THEN right(r.customer_phone,4) END AS phone_last4,
  CASE WHEN r.expires_at > now() THEN r.customer_phone END AS customer_phone,
  CASE WHEN r.expires_at > now() THEN r.cart_items ELSE '[]'::jsonb END AS cart_items,
  r.expires_at > now() AND r.contact_allowed AS contact_allowed,
  (SELECT coalesce(sum((item->>'quantity')::int),0) FROM jsonb_array_elements(r.cart_items) AS item) AS item_count,
  o.id AS order_id, o.order_number,
  CASE WHEN coalesce(o.has_link,false) THEN 'payment_link' ELSE 'checkout_started' END AS stage,
  CASE
    WHEN o.payment_status = 'paid' THEN 'converted'
    WHEN r.expires_at <= now() THEN 'expired'
    WHEN r.ignored_at IS NOT NULL THEN 'ignored'
    WHEN o.payment_status = 'requires_review' OR o.order_status = 'requires_review' THEN 'review'
    WHEN r.last_activity_at <= now() - interval '1 hour' THEN 'abandoned'
    ELSE 'active'
  END AS status
FROM public.ecommerce_checkout_recovery r
LEFT JOIN LATERAL (
  SELECT owned.*, EXISTS (SELECT 1 FROM public.ecommerce_payment_attempts a WHERE a.order_id = owned.id
    AND nullif(a.checkout_url,'') IS NOT NULL AND nullif(a.provider_checkout_id,'') IS NOT NULL) AS has_link
  FROM (
    SELECT o.id, o.order_number, o.payment_status, o.order_status
    FROM public.ecommerce_orders o
    WHERE o.store_id = 'marjouxs' AND o.customer_phone = r.customer_phone
      AND o.checkout_idempotency_key IN (SELECT 'checkout:' || key::text FROM unnest(r.checkout_request_ids) AS refs(key))
    ORDER BY (o.payment_status = 'paid') DESC NULLS LAST, (o.payment_status = 'requires_review') DESC NULLS LAST,
      o.created_at DESC, o.id DESC LIMIT 1
  ) AS owned
) AS o ON true
WHERE jsonb_array_length(r.cart_items) > 0 OR o.id IS NOT NULL;

REVOKE ALL ON public.ecommerce_checkout_recovery_admin FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ecommerce_checkout_recovery_admin TO service_role;

COMMIT;
