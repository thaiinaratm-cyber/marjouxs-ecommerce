-- PROPOSAL ONLY. Not applied. Requires explicit approval and coordinated application rollout.
-- No table, column, index, RLS, payment verification, or existing row is changed by installation.
-- Stop checkout creation and drain old workers before adopting the new protocol.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  v_definition text;
  v_needle text := '      ''order_number'', v_order_number';
  v_replacement text;
BEGIN
  IF CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed proposal as postgres';
  END IF;
  IF pg_catalog.to_regprocedure('public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Checkout link transition already exists; review before replacing';
  END IF;
  SELECT pg_catalog.pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = 'public.ecommerce_create_checkout(jsonb,jsonb,text,text)'::regprocedure;

  IF pg_catalog.md5(v_definition) IS DISTINCT FROM 'b1143320c126176b8ef8a7f2ff1552a6' THEN
    RAISE EXCEPTION 'ecommerce_create_checkout changed since the read-only audit';
  END IF;
  IF pg_catalog.array_length(pg_catalog.string_to_array(v_definition, v_needle), 1) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly one payment-attempt metadata insertion point';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'public.ecommerce_set_checkout_link(uuid,text,text)'::regprocedure
      AND pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) = 'dc92c928aa83da39ade7f603dbdfbb23'
  ) THEN
    RAISE EXCEPTION 'ecommerce_set_checkout_link changed since the read-only audit';
  END IF;

  -- New attempts alone opt into the protocol. Historical creating attempts fail closed.
  v_replacement := v_needle || E',\n      ''checkout_link_dispatch'', pg_catalog.jsonb_build_object(\n        ''version'', 1,\n        ''state'', ''unclaimed''\n      )';
  EXECUTE pg_catalog.replace(v_definition, v_needle, v_replacement);
END;
$preflight$;

CREATE FUNCTION public.ecommerce_checkout_link_transition(
  p_attempt_id uuid,
  p_action text,
  p_claim_token uuid,
  p_checkout_url text DEFAULT NULL,
  p_provider_checkout_id text DEFAULT NULL
)
RETURNS TABLE (
  result_code text,
  result_attempt_id uuid,
  result_attempt_status text,
  result_checkout_url text,
  result_provider_checkout_id text,
  result_lease_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order_id uuid;
  v_order public.ecommerce_orders%ROWTYPE;
  v_attempt public.ecommerce_payment_attempts%ROWTYPE;
  v_dispatch jsonb;
  v_owner uuid;
  v_lease_until timestamptz;
  v_now timestamptz;
  v_code text;
  v_link record;
BEGIN
  IF p_attempt_id IS NULL OR p_claim_token IS NULL
     OR p_action IS NULL OR p_action NOT IN ('claim', 'begin_dispatch', 'complete') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid checkout link transition';
  END IF;
  IF p_action <> 'complete'
     AND (p_checkout_url IS NOT NULL OR p_provider_checkout_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unexpected checkout link arguments';
  END IF;
  IF p_action = 'complete' AND (
    p_checkout_url IS NULL OR p_checkout_url !~ '^https://'
    OR p_provider_checkout_id IS NULL OR pg_catalog.btrim(p_provider_checkout_id) = ''
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid checkout link result';
  END IF;

  SELECT pa.order_id INTO v_order_id
  FROM public.ecommerce_payment_attempts AS pa
  WHERE pa.id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Payment attempt not found';
  END IF;

  -- Same order -> attempt lock order used by the existing link-registration RPC.
  SELECT eo.* INTO v_order FROM public.ecommerce_orders AS eo
  WHERE eo.id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Checkout order not found';
  END IF;
  SELECT pa.* INTO v_attempt FROM public.ecommerce_payment_attempts AS pa
  WHERE pa.id = p_attempt_id AND pa.order_id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Payment attempt not found';
  END IF;
  v_now := pg_catalog.clock_timestamp();

  IF v_order.payment_status = 'paid' OR v_attempt.status = 'paid' THEN
    RETURN QUERY SELECT 'already_paid'::text, v_attempt.id, v_attempt.status,
      NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_order.payment_status <> 'pending' OR v_order.order_status <> 'pending_payment'
     OR v_attempt.provider <> 'infinitepay'
     OR v_order.payment_provider <> 'infinitepay'
     OR v_attempt.requested_amount_cents <> v_order.total_cents THEN
    RETURN QUERY SELECT 'attempt_not_available'::text, v_attempt.id, v_attempt.status,
      NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_attempt.status = 'pending' AND v_attempt.checkout_url ~ '^https://'
     AND v_attempt.provider_checkout_id IS NOT NULL
     AND pg_catalog.btrim(v_attempt.provider_checkout_id) <> '' THEN
    RETURN QUERY SELECT 'reuse_link'::text, v_attempt.id, v_attempt.status,
      v_attempt.checkout_url, v_attempt.provider_checkout_id, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_attempt.status <> 'creating' OR v_attempt.checkout_url IS NOT NULL
     OR v_attempt.provider_checkout_id IS NOT NULL THEN
    RETURN QUERY SELECT 'attempt_not_available'::text, v_attempt.id, v_attempt.status,
      NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  v_dispatch := v_attempt.request_metadata -> 'checkout_link_dispatch';
  IF v_dispatch IS NULL THEN
    -- Do not retry an old attempt whose external side effect is unknown.
    RETURN QUERY SELECT 'legacy_dispatch_unknown'::text, v_attempt.id, v_attempt.status,
      NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF pg_catalog.jsonb_typeof(v_dispatch) <> 'object'
     OR (v_dispatch ->> 'version') IS DISTINCT FROM '1'
     OR (v_dispatch ->> 'state') IS NULL
     OR (v_dispatch ->> 'state') NOT IN ('unclaimed', 'reserved', 'dispatched') THEN
    RETURN QUERY SELECT 'dispatch_state_invalid'::text, v_attempt.id, v_attempt.status,
      NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_dispatch ->> 'state' IN ('reserved', 'dispatched') THEN
    BEGIN
      v_owner := (v_dispatch ->> 'owner')::uuid;
      v_lease_until := (v_dispatch ->> 'lease_until')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      v_owner := NULL;
      v_lease_until := NULL;
    END;
    IF v_owner IS NULL OR v_lease_until IS NULL THEN
      RETURN QUERY SELECT 'dispatch_state_invalid'::text, v_attempt.id, v_attempt.status,
        NULL::text, NULL::text, NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  IF p_action = 'claim' THEN
    IF v_dispatch ->> 'state' = 'dispatched' THEN
      v_code := CASE WHEN v_now < v_lease_until THEN 'in_progress' ELSE 'dispatch_uncertain' END;
    ELSIF v_dispatch ->> 'state' = 'reserved' AND v_now < v_lease_until THEN
      v_code := 'in_progress';
    ELSE
      -- A reservation can be reclaimed only if begin_dispatch never committed.
      v_lease_until := v_now + interval '2 minutes';
      v_dispatch := pg_catalog.jsonb_build_object(
        'version', 1, 'state', 'reserved', 'owner', p_claim_token,
        'claimed_at', v_now, 'lease_until', v_lease_until
      );
      UPDATE public.ecommerce_payment_attempts AS pa
      SET request_metadata = pg_catalog.jsonb_set(pa.request_metadata, '{checkout_link_dispatch}', v_dispatch, true)
      WHERE pa.id = v_attempt.id;
      v_code := 'reserved';
    END IF;
  ELSIF p_action = 'begin_dispatch' THEN
    IF v_dispatch ->> 'state' = 'reserved' AND v_owner = p_claim_token
       AND v_now < v_lease_until THEN
      v_dispatch := v_dispatch || pg_catalog.jsonb_build_object('state', 'dispatched', 'dispatched_at', v_now);
      UPDATE public.ecommerce_payment_attempts AS pa
      SET request_metadata = pg_catalog.jsonb_set(pa.request_metadata, '{checkout_link_dispatch}', v_dispatch, true)
      WHERE pa.id = v_attempt.id;
      -- This result is issued once. A lost response must not authorize another HTTP call.
      v_code := 'dispatch_granted';
    ELSIF v_dispatch ->> 'state' = 'dispatched' THEN
      v_code := 'dispatch_uncertain';
    ELSE
      v_code := 'stale_claim';
    END IF;
  ELSE
    IF v_dispatch ->> 'state' <> 'dispatched' OR v_owner IS DISTINCT FROM p_claim_token THEN
      RETURN QUERY SELECT 'stale_claim'::text, v_attempt.id, v_attempt.status,
        NULL::text, NULL::text, v_lease_until;
      RETURN;
    END IF;
    -- No payment verification or paid-state rule is replaced here.
    SELECT * INTO v_link FROM public.ecommerce_set_checkout_link(
      p_attempt_id, p_checkout_url, p_provider_checkout_id
    );
    SELECT pa.* INTO v_attempt FROM public.ecommerce_payment_attempts AS pa WHERE pa.id = p_attempt_id;
    RETURN QUERY SELECT v_link.result_code, v_attempt.id, v_attempt.status,
      v_attempt.checkout_url, v_attempt.provider_checkout_id, v_lease_until;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_code, v_attempt.id, v_attempt.status,
    NULL::text, NULL::text, v_lease_until;
END;
$function$;

ALTER FUNCTION public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text) TO service_role;

COMMIT;
