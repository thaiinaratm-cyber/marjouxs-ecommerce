-- Proposed migration only. Execute only after explicit approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.ecommerce_integration_outbox IN ACCESS EXCLUSIVE MODE;

DO $migration$
DECLARE
  constraint_name text;
  constraint_count integer;
BEGIN
  SELECT count(*), min(c.conname::text)
    INTO constraint_count, constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid
    AND a.attname = 'event_type' AND NOT a.attisdropped
  WHERE c.conrelid = 'public.ecommerce_integration_outbox'::regclass
    AND c.contype = 'c' AND c.conkey = ARRAY[a.attnum];

  IF constraint_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one CHECK on event_type; found %', constraint_count;
  END IF;

  EXECUTE format('ALTER TABLE public.ecommerce_integration_outbox DROP CONSTRAINT %I', constraint_name);
  EXECUTE format(
    'ALTER TABLE public.ecommerce_integration_outbox ADD CONSTRAINT %I CHECK (event_type IN (''ga4_purchase'', ''erp_financial'', ''order.paid''))',
    constraint_name
  );
END
$migration$;

COMMIT;
