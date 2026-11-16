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
  product_name text, product_image text, category text, subcategory text, material text, availability text,
  unit_price_cents bigint, quantity integer, customization jsonb
);
CREATE TABLE public.ecommerce_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES public.ecommerce_orders(id),
  provider text, idempotency_key text UNIQUE, order_nsu text, status text, requested_amount_cents bigint,
  checkout_url text, request_metadata jsonb, created_at timestamptz DEFAULT now()
);
-- The legacy validator is not replaced by the migration.
CREATE FUNCTION public.ecommerce_valid_ring_pair(j jsonb) RETURNS boolean LANGUAGE sql AS $$
  SELECT j ->> 'type' = 'ring_pair'
    AND j - ARRAY['type','ring1','ring2'] = '{}'::jsonb
    AND (j #>> '{ring1,size}')::int BETWEEN 8 AND 35
    AND (j #>> '{ring2,size}')::int BETWEEN 8 AND 35;
$$;
INSERT INTO public.ecommerce_categories VALUES ('ring','Anéis',true), ('pair','Alianças',true);
INSERT INTO public.ecommerce_materials VALUES ('metal',true);
INSERT INTO public.ecommerce_products VALUES
  ('00000000-0000-4000-8000-000000000001','normal','normal',true,160,'available','ring',null,'metal','unit'),
  ('00000000-0000-4000-8000-000000000002',null,'stones',true,160,'available','ring',null,'metal','unit'),
  ('00000000-0000-4000-8000-000000000003','pair','pair',true,160,'available','pair',null,'metal','pair'),
  ('00000000-0000-4000-8000-000000000004','pair-stone','pair-stone',true,160,'available','pair',null,'metal','pair'),
  ('00000000-0000-4000-8000-000000000005','inactive','inactive',false,160,'available','ring',null,'metal','unit');
INSERT INTO public.ecommerce_product_images SELECT id,true FROM public.ecommerce_products;
