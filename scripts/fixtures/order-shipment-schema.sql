-- Isolated test fixture only. All records and roles are synthetic.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.ecommerce_orders (
  id uuid PRIMARY KEY,
  public_token uuid UNIQUE NOT NULL,
  order_number text UNIQUE NOT NULL,
  delivery_method text NOT NULL,
  payment_status text NOT NULL,
  order_status text NOT NULL,
  updated_at timestamptz NOT NULL,
  shipping_carrier text,
  shipping_cents bigint NOT NULL,
  total_cents bigint NOT NULL,
  payment_method text
);
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ecommerce_orders VALUES
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-9000-000000000001',
    'MJ-000001','shipping','paid','preparing','2026-11-15T00:00:00Z','Correios',994,16994,'pix'),
  ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-9000-000000000002',
    'MJ-000002','pickup','paid','ready_for_pickup','2026-11-15T00:00:00Z',NULL,0,16000,'pix'),
  ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-9000-000000000003',
    'MJ-000003','shipping','pending','pending_payment','2026-11-15T00:00:00Z','Correios',994,16994,NULL);

-- Fields referenced by the audited production protection trigger.
ALTER TABLE public.ecommerce_orders
  ADD COLUMN order_sequence bigint, ADD COLUMN checkout_idempotency_key text, ADD COLUMN checkout_request_hash text,
  ADD COLUMN store_id text, ADD COLUMN customer_name text, ADD COLUMN customer_phone text, ADD COLUMN customer_email text,
  ADD COLUMN customer_cpf text, ADD COLUMN shipping_zip text, ADD COLUMN shipping_street text, ADD COLUMN shipping_number text,
  ADD COLUMN shipping_complement text, ADD COLUMN shipping_neighborhood text, ADD COLUMN shipping_city text,
  ADD COLUMN shipping_state text, ADD COLUMN shipping_provider text, ADD COLUMN shipping_service text,
  ADD COLUMN shipping_service_id text, ADD COLUMN shipping_quote_id uuid, ADD COLUMN shipping_quoted_at timestamptz,
  ADD COLUMN shipping_deadline_days integer, ADD COLUMN subtotal_cents bigint, ADD COLUMN discount_cents bigint,
  ADD COLUMN payment_provider text, ADD COLUMN paid_at timestamptz, ADD COLUMN created_at timestamptz;
GRANT SELECT ON public.ecommerce_orders TO service_role;

CREATE FUNCTION public.fixture_touch_order() RETURNS trigger
LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;

-- Detect DDL even if a later error would roll it back. On the valid path
-- verify that the exclusive lock is already held when the first DDL starts.
CREATE FUNCTION public.fixture_shipment_ddl_probe() RETURNS event_trigger
LANGUAGE plpgsql AS $$
DECLARE
  mode text := current_setting('fixture.shipment_probe', true);
BEGIN
  IF mode = 'reject_ddl' THEN
    RAISE EXCEPTION 'Fixture: unexpected DDL before precheck failure (%)', TG_TAG;
  END IF;
  IF mode IN ('check_lock', 'fail_after_rebind', 'fail_after_alter') THEN
    IF current_setting('lock_timeout') <> '5s'
      OR NOT EXISTS (SELECT 1 FROM pg_locks WHERE pid = pg_backend_pid()
        AND locktype = 'relation' AND relation = 'public.ecommerce_orders'::regclass
        AND granted AND pg_locks.mode = 'AccessExclusiveLock') THEN
      RAISE EXCEPTION 'Fixture: missing exclusive lock or lock_timeout';
    END IF;
    IF mode IN ('fail_after_rebind', 'fail_after_alter')
      AND (TG_TAG = 'ALTER TABLE' OR (TG_TAG = 'CREATE FUNCTION' AND to_regprocedure('public.ecommerce_orders_touch_updated_at()') IS NOT NULL)) THEN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.ecommerce_orders'::regclass
        AND tgname = 'ecommerce_orders_10_touch_updated_at'
        AND tgfoid = to_regprocedure('public.ecommerce_orders_touch_updated_at()')) THEN
        RAISE EXCEPTION 'Fixture: trigger was not rebound';
      END IF;
    END IF;
    IF mode = 'fail_after_rebind' AND TG_TAG = 'ALTER TABLE' THEN
      RAISE EXCEPTION 'Fixture: abort after trigger rebind';
    END IF;
    IF mode = 'fail_after_alter' AND TG_TAG = 'CREATE FUNCTION'
      AND to_regprocedure('public.ecommerce_orders_touch_updated_at()') IS NOT NULL THEN
      RAISE EXCEPTION 'Fixture: abort after ALTER TABLE';
    END IF;
  END IF;
END;
$$;
CREATE EVENT TRIGGER fixture_shipment_ddl ON ddl_command_start
  WHEN TAG IN ('ALTER TABLE', 'CREATE FUNCTION', 'CREATE TRIGGER') EXECUTE FUNCTION public.fixture_shipment_ddl_probe();
