-- Stage 17. Apply only with a separately approved production release.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.ecommerce_orders
  ADD COLUMN dispatch_carrier text,
  ADD COLUMN tracking_code text,
  ADD COLUMN tracking_url text,
  ADD COLUMN shipping_status text,
  ADD COLUMN shipped_at timestamptz,
  ADD COLUMN in_transit_at timestamptz,
  ADD COLUMN delivered_at timestamptz,
  ADD CONSTRAINT ecommerce_orders_shipping_status_ck
    CHECK (shipping_status IN ('preparing', 'shipped', 'in_transit', 'delivered')),
  ADD CONSTRAINT ecommerce_orders_tracking_format_ck CHECK (
    (dispatch_carrier IS NULL OR (
      dispatch_carrier = btrim(dispatch_carrier)
      AND char_length(dispatch_carrier) BETWEEN 1 AND 100
      AND dispatch_carrier !~ '[<>[:cntrl:]]'
    ))
    AND (tracking_code IS NULL OR tracking_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')
    AND (tracking_url IS NULL OR (tracking_url ~ '^https://[^/?#[:space:]]+'
      AND tracking_url !~ '[[:space:][:cntrl:]]' AND char_length(tracking_url) <= 2048))
  ),
  ADD CONSTRAINT ecommerce_orders_shipment_scope_ck CHECK (
    delivery_method = 'shipping' OR (
      dispatch_carrier IS NULL AND tracking_code IS NULL AND tracking_url IS NULL
      AND shipping_status IS NULL AND shipped_at IS NULL AND in_transit_at IS NULL
      AND delivered_at IS NULL
    )
  );

CREATE FUNCTION public.ecommerce_update_order_shipment(
  p_order_id uuid, p_expected_updated_at timestamptz, p_carrier text, p_code text,
  p_url text, p_status text, p_confirm_delivered boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  previous_order public.ecommerce_orders%ROWTYPE;
  stages constant text[] := ARRAY['preparing', 'shipped', 'in_transit', 'delivered'];
  current_stage text;
  next_stage integer;
  changed_at timestamptz;
BEGIN
  SELECT * INTO previous_order FROM public.ecommerce_orders
    WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR previous_order.delivery_method IS DISTINCT FROM 'shipping'
    OR previous_order.payment_status IS DISTINCT FROM 'paid'
    OR previous_order.order_status NOT IN ('paid', 'preparing', 'shipped', 'completed') THEN
    RETURN 'invalid';
  END IF;
  IF previous_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN 'conflict';
  END IF;

  current_stage := coalesce(previous_order.shipping_status, CASE previous_order.order_status
    WHEN 'completed' THEN 'delivered' WHEN 'shipped' THEN 'shipped' ELSE 'preparing' END);
  next_stage := array_position(stages, p_status);
  IF next_stage IS NULL OR next_stage < array_position(stages, current_stage)
    OR next_stage > array_position(stages, current_stage) + 1
    OR (p_status = 'delivered' AND current_stage <> 'delivered' AND p_confirm_delivered IS NOT TRUE) THEN
    RETURN 'invalid';
  END IF;

  IF current_stage = p_status AND previous_order.dispatch_carrier IS NOT DISTINCT FROM p_carrier
    AND previous_order.tracking_code IS NOT DISTINCT FROM p_code
    AND previous_order.tracking_url IS NOT DISTINCT FROM p_url THEN
    RETURN 'saved';
  END IF;

  changed_at := greatest(clock_timestamp(), previous_order.updated_at + interval '1 microsecond');
  UPDATE public.ecommerce_orders SET
    dispatch_carrier = p_carrier,
    tracking_code = p_code,
    tracking_url = p_url,
    shipping_status = CASE WHEN current_stage <> p_status THEN p_status ELSE shipping_status END,
    order_status = CASE
      WHEN current_stage = p_status THEN order_status
      WHEN p_status = 'delivered' THEN 'completed'
      WHEN p_status IN ('shipped', 'in_transit') THEN 'shipped'
      ELSE order_status END,
    shipped_at = CASE WHEN current_stage <> p_status AND p_status = 'shipped'
      THEN coalesce(shipped_at, changed_at) ELSE shipped_at END,
    in_transit_at = CASE WHEN current_stage <> p_status AND p_status = 'in_transit'
      THEN coalesce(in_transit_at, changed_at) ELSE in_transit_at END,
    delivered_at = CASE WHEN current_stage <> p_status AND p_status = 'delivered'
      THEN coalesce(delivered_at, changed_at) ELSE delivered_at END,
    updated_at = changed_at
  WHERE id = p_order_id;

  RETURN 'saved';
END;
$function$;

REVOKE ALL ON FUNCTION public.ecommerce_update_order_shipment(uuid, timestamptz, text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ecommerce_update_order_shipment(uuid, timestamptz, text, text, text, text, boolean)
  TO service_role;
GRANT SELECT (dispatch_carrier, tracking_code, tracking_url, shipping_status, shipped_at, in_transit_at, delivered_at)
  ON public.ecommerce_orders TO service_role;

COMMIT;
