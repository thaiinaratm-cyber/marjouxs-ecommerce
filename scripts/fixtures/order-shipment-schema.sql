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
  IF mode IN ('check_lock', 'fail_after_alter') THEN
    IF current_setting('lock_timeout') <> '5s'
      OR NOT EXISTS (SELECT 1 FROM pg_locks WHERE pid = pg_backend_pid()
        AND locktype = 'relation' AND relation = 'public.ecommerce_orders'::regclass
        AND granted AND pg_locks.mode = 'AccessExclusiveLock') THEN
      RAISE EXCEPTION 'Fixture: missing exclusive lock or lock_timeout';
    END IF;
    IF mode = 'fail_after_alter' AND TG_TAG = 'CREATE FUNCTION' THEN
      RAISE EXCEPTION 'Fixture: abort after ALTER TABLE';
    END IF;
  END IF;
END;
$$;
CREATE EVENT TRIGGER fixture_shipment_ddl ON ddl_command_start
  WHEN TAG IN ('ALTER TABLE', 'CREATE FUNCTION') EXECUTE FUNCTION public.fixture_shipment_ddl_probe();
