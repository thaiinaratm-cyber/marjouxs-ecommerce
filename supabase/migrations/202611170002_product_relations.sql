-- Stage 19: separate production approval is required.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $precheck$
DECLARE
  products regclass := to_regclass('public.ecommerce_products');
  mismatch text;
BEGIN
  IF current_user <> 'postgres' OR products IS NULL THEN
    RAISE EXCEPTION 'Product relations precheck: expected postgres and ecommerce_products';
  END IF;
  LOCK TABLE public.ecommerce_products IN ACCESS SHARE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = products AND relkind = 'r' AND relrowsecurity AND pg_get_userbyid(relowner) = 'postgres') THEN
    RAISE EXCEPTION 'Product relations precheck: expected products owned by postgres with RLS enabled';
  END IF;
  IF to_regclass('public.ecommerce_product_relations') IS NOT NULL
    OR to_regclass('public.ecommerce_product_relations_target_idx') IS NOT NULL
    OR to_regclass('public.ecommerce_product_relations_pkey') IS NOT NULL
    OR to_regclass('public.ecommerce_product_relations_product_id_position_key') IS NOT NULL
    OR to_regprocedure('public.ecommerce_get_product_recommendations(text,text[])') IS NOT NULL
    OR to_regprocedure('public.ecommerce_set_product_relations(uuid,bigint,uuid[],uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'Product relations precheck: existing or partial installation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role' AND rolbypassrls)
    OR NOT has_schema_privilege('service_role', 'public', 'USAGE')
    OR pg_has_role('anon', 'service_role', 'MEMBER')
    OR pg_has_role('authenticated', 'service_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Product relations precheck: unexpected service role or grants';
  END IF;
  SELECT string_agg(e.name, ', ' ORDER BY e.name) INTO mismatch
  FROM (VALUES
    ('id', ARRAY['uuid'::regtype]), ('slug', ARRAY['text'::regtype]),
    ('is_active', ARRAY['boolean'::regtype]), ('stock_status', ARRAY['text'::regtype]),
    ('version', ARRAY['integer'::regtype, 'bigint'::regtype])
  ) AS e(name, types)
  LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = products AND a.attname = e.name AND NOT a.attisdropped
  WHERE NOT coalesce(a.atttypid = ANY(e.types), false)
    OR NOT has_column_privilege('service_role', a.attrelid, a.attnum, 'SELECT');
  IF mismatch IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a ON a.attrelid = products AND a.attname = 'id'
    WHERE c.conrelid = products AND c.contype = 'p' AND c.conkey = ARRAY[a.attnum]) THEN
    RAISE EXCEPTION 'Product relations precheck: incompatible or unreadable products schema (%)', coalesce(mismatch, 'id primary key');
  END IF;
END;
$precheck$;

CREATE TABLE public.ecommerce_product_relations (
  product_id uuid NOT NULL REFERENCES public.ecommerce_products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.ecommerce_products(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, related_product_id),
  UNIQUE (product_id, position),
  CHECK (product_id <> related_product_id)
);
CREATE INDEX ecommerce_product_relations_target_idx ON public.ecommerce_product_relations(related_product_id);
ALTER TABLE public.ecommerce_product_relations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ecommerce_product_relations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ecommerce_product_relations TO service_role;

CREATE FUNCTION public.ecommerce_set_product_relations(
  p_id uuid, p_version bigint, p_expected uuid[], p_related uuid[]
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $set$
DECLARE
  saved_version bigint;
  saved_ids uuid[];
BEGIN
  IF p_id IS NULL OR p_version IS NULL OR p_expected IS NULL OR p_related IS NULL
    OR cardinality(p_expected) > 8 OR cardinality(p_related) > 8
    OR coalesce(array_ndims(p_related),1) <> 1 OR coalesce(array_ndims(p_expected),1) <> 1
    OR cardinality(p_related) <> (SELECT count(DISTINCT id) FROM unnest(p_related) AS ids(id))
    OR p_id = ANY(p_related) THEN RETURN 'invalid'; END IF;

  -- Lock the source and targets in a stable order; a target cannot deactivate mid-save.
  PERFORM id FROM public.ecommerce_products WHERE id = p_id OR id = ANY(p_related)
    ORDER BY id FOR NO KEY UPDATE;
  SELECT version INTO saved_version FROM public.ecommerce_products WHERE id = p_id;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  SELECT coalesce(array_agg(related_product_id ORDER BY position), '{}'::uuid[]) INTO saved_ids
    FROM public.ecommerce_product_relations WHERE product_id = p_id;
  IF saved_version IS DISTINCT FROM p_version OR saved_ids IS DISTINCT FROM p_expected THEN RETURN 'conflict'; END IF;
  IF (SELECT count(*) FROM public.ecommerce_products
    WHERE id = ANY(p_related) AND is_active AND stock_status IN ('available','made_to_order')) <> cardinality(p_related)
    THEN RETURN 'invalid'; END IF;
  IF saved_ids = p_related THEN RETURN 'saved'; END IF;

  DELETE FROM public.ecommerce_product_relations WHERE product_id = p_id;
  INSERT INTO public.ecommerce_product_relations (product_id, related_product_id, position)
    SELECT p_id, id, ord::int FROM unnest(p_related) WITH ORDINALITY AS selected(id, ord);
  RETURN 'saved';
END;
$set$;

CREATE FUNCTION public.ecommerce_get_product_recommendations(p_slug text, p_fallback text[])
RETURNS TABLE (mode text, related_slug text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $read$
  WITH source AS (
    SELECT id FROM public.ecommerce_products WHERE slug = p_slug AND is_active
  ), manual AS (
    SELECT r.position AS sort_position, t.slug
    FROM source s JOIN public.ecommerce_product_relations r ON r.product_id = s.id
    LEFT JOIN public.ecommerce_products t ON t.id = r.related_product_id
      AND t.is_active AND t.stock_status IN ('available','made_to_order')
  ), choices AS (
    SELECT 'manual' AS mode, slug, sort_position FROM manual
    UNION ALL
    SELECT 'automatic', p.slug, min(f.ord)::int
    FROM source s CROSS JOIN unnest(p_fallback[1:16]) WITH ORDINALITY AS f(slug, ord)
    JOIN public.ecommerce_products p ON p.slug = f.slug AND p.is_active AND p.stock_status IN ('available','made_to_order')
    WHERE p.id <> s.id AND NOT EXISTS (SELECT 1 FROM manual)
    GROUP BY p.slug
  )
  SELECT mode, slug FROM choices ORDER BY sort_position, slug
$read$;

REVOKE ALL ON FUNCTION public.ecommerce_set_product_relations(uuid,bigint,uuid[],uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ecommerce_get_product_recommendations(text,text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ecommerce_set_product_relations(uuid,bigint,uuid[],uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.ecommerce_get_product_recommendations(text,text[]) TO service_role;
COMMIT;
