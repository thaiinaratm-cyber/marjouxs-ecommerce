-- PROPOSAL ONLY. Do not run while any old/new checkout-creation worker is active.
-- Keep checkout creation paused until uncertain attempts have been reconciled.
-- Rolling back to the old code reintroduces its duplicate-provider-call risk.
-- Safe rollback requires these steps, in order:
-- 1. Pause new checkout creation.
-- 2. Drain in-flight requests and workers.
-- 3. Reconcile attempts with uncertain dispatches.
-- 4. Run the guard below; it does not replace the operational steps.
-- 5. Only then restore the previous functions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $rollback$
DECLARE
  v_definition text;
  v_restored text;
  v_needle text := '      ''order_number'', v_order_number';
  v_replacement text;
BEGIN
  IF CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed rollback as postgres';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ecommerce_payment_attempts AS pa
    WHERE pa.status = 'creating'
      AND pa.request_metadata ? 'checkout_link_dispatch'
      AND (pa.request_metadata -> 'checkout_link_dispatch')
        IS DISTINCT FROM '{"version":1,"state":"unclaimed"}'::jsonb
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Checkout dispatches must be drained and reconciled before rollback';
  END IF;
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = 'public.ecommerce_create_checkout(jsonb,jsonb,text,text)'::regprocedure;
  v_replacement := v_needle || E',\n      ''checkout_link_dispatch'', pg_catalog.jsonb_build_object(\n        ''version'', 1,\n        ''state'', ''unclaimed''\n      )';
  IF pg_catalog.array_length(pg_catalog.string_to_array(v_definition, v_replacement), 1) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly one reviewed protocol marker';
  END IF;
  v_restored := pg_catalog.replace(v_definition, v_replacement, v_needle);
  IF pg_catalog.md5(v_restored) IS DISTINCT FROM 'b1143320c126176b8ef8a7f2ff1552a6' THEN
    RAISE EXCEPTION 'Other RPC changes detected; rollback requires review';
  END IF;
  EXECUTE v_restored;
END;
$rollback$;

DROP FUNCTION public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text);
-- Retain all orders/attempts and their dispatch metadata for audit/reconciliation.
COMMIT;
