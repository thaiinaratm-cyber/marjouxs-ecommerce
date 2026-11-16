-- Synthetic schema for the in-memory RPC test. Never run in Supabase.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SEQUENCE public.ecommerce_order_sequence;
CREATE TABLE public.ecommerce_categories (id text PRIMARY KEY, name text, is_active boolean);
CREATE TABLE public.ecommerce_materials (id text PRIMARY KEY, is_active boolean);
CREATE TABLE public.ecommerce_subcategories (id text PRIMARY KEY, category_id text, is_active boolean);
CREATE TABLE public.ecommerce_products (
  id uuid PRIMARY KEY, legacy_id text UNIQUE, slug text UNIQUE, is_active boolean, price numeric,
  stock_status text, category_id text, subcategory_id text, material_id text, sale_unit text
);
CREATE TABLE public.ecommerce_product_images (product_id uuid, is_primary boolean);
CREATE TABLE public.ecommerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_token uuid DEFAULT gen_random_uuid(),
  order_sequence bigint, order_number text, checkout_idempotency_key text UNIQUE, checkout_request_hash text, store_id text,
  customer_name text, customer_phone text, customer_email text, customer_cpf text, delivery_method text,
  shipping_zip text, shipping_street text, shipping_number text, shipping_complement text, shipping_neighborhood text,
  shipping_city text, shipping_state text, shipping_provider text, shipping_carrier text, shipping_service text,
  shipping_service_id text, shipping_quote_id uuid, shipping_quoted_at timestamptz, shipping_deadline_days integer,
  subtotal_cents bigint, shipping_cents bigint, discount_cents bigint, total_cents bigint, payment_provider text,
  ga_client_id text, ga_session_id text
);
CREATE TABLE public.ecommerce_order_items (
  order_id uuid REFERENCES public.ecommerce_orders(id), line_number integer, product_id text, product_slug text,
  product_name text, product_image text, category text NOT NULL, subcategory text, material text, availability text,
  unit_price_cents bigint, quantity integer NOT NULL, customization jsonb
);
CREATE TABLE public.ecommerce_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES public.ecommerce_orders(id),
  provider text, idempotency_key text UNIQUE, order_nsu text, status text, requested_amount_cents bigint,
  checkout_url text, request_metadata jsonb, created_at timestamptz DEFAULT now()
);
-- Production definition captured with pg_get_functiondef, normalized to LF.
CREATE OR REPLACE FUNCTION public.ecommerce_valid_ring_pair(p_customization jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
declare
  v_ring1 jsonb;
  v_ring2 jsonb;
begin
  if pg_catalog.jsonb_typeof(p_customization) <> 'object' then
    return false;
  end if;

  if p_customization ->> 'type' <> 'ring_pair' then
    return false;
  end if;

  if not (
    p_customization ? 'type'
    and p_customization ? 'ring1'
    and p_customization ? 'ring2'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_customization) as keys(key_name)
    where keys.key_name not in ('type', 'ring1', 'ring2')
  ) then
    return false;
  end if;

  v_ring1 := p_customization -> 'ring1';
  v_ring2 := p_customization -> 'ring2';

  if pg_catalog.jsonb_typeof(v_ring1) <> 'object'
     or pg_catalog.jsonb_typeof(v_ring2) <> 'object' then
    return false;
  end if;

  if not (v_ring1 ? 'size') or not (v_ring2 ? 'size') then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(v_ring1) as keys(key_name)
    where keys.key_name not in ('size', 'engraving')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(v_ring2) as keys(key_name)
    where keys.key_name not in ('size', 'engraving')
  ) then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(v_ring1 -> 'size') <> 'number'
     or pg_catalog.jsonb_typeof(v_ring2 -> 'size') <> 'number' then
    return false;
  end if;

  if (v_ring1 ->> 'size') !~ '^(8|9|[12][0-9]|3[0-5])$'
     or (v_ring2 ->> 'size') !~ '^(8|9|[12][0-9]|3[0-5])$' then
    return false;
  end if;

  if v_ring1 ? 'engraving'
     and pg_catalog.jsonb_typeof(v_ring1 -> 'engraving')
         not in ('string', 'null') then
    return false;
  end if;

  if v_ring2 ? 'engraving'
     and pg_catalog.jsonb_typeof(v_ring2 -> 'engraving')
         not in ('string', 'null') then
    return false;
  end if;

  return true;
end;
$function$;

-- Exact production CHECK from pg_get_constraintdef (validator schema-qualified in DDL).
ALTER TABLE public.ecommerce_order_items
  ADD CONSTRAINT ecommerce_order_items_customization_ck
  CHECK ((((category = 'Alianças'::text) AND (quantity = 1) AND (public.ecommerce_valid_ring_pair(customization) IS TRUE)) OR ((category <> 'Alianças'::text) AND (customization IS NULL))));

INSERT INTO public.ecommerce_categories VALUES ('ring','Anéis',true), ('pair','Alianças',true);
INSERT INTO public.ecommerce_materials VALUES ('metal',true);
INSERT INTO public.ecommerce_products VALUES
  ('00000000-0000-4000-8000-000000000001','normal','normal',true,160,'available','ring',null,'metal','unit'),
  ('00000000-0000-4000-8000-000000000002',null,'stones',true,160,'available','ring',null,'metal','unit'),
  ('00000000-0000-4000-8000-000000000003','pair','pair',true,160,'available','pair',null,'metal','pair'),
  ('00000000-0000-4000-8000-000000000004','pair-stone','pair-stone',true,160,'available','pair',null,'metal','pair'),
  ('00000000-0000-4000-8000-000000000005','inactive','inactive',false,160,'available','ring',null,'metal','unit');
INSERT INTO public.ecommerce_product_images SELECT id,true FROM public.ecommerce_products;
