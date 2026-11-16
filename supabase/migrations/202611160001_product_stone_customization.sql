-- Stage 15A: apply only during the separately approved consolidated release.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.ecommerce_products
  ADD COLUMN stone_customization_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN stone_options text[] NOT NULL DEFAULT '{}'::text[],
  ADD CONSTRAINT ecommerce_products_stone_options_ck CHECK (
    (NOT stone_customization_enabled AND pg_catalog.cardinality(stone_options) = 0)
    OR (
      stone_customization_enabled
      AND pg_catalog.array_ndims(stone_options) = 1
      AND pg_catalog.cardinality(stone_options) BETWEEN 1 AND 24
      AND pg_catalog.array_position(stone_options, NULL::text) IS NULL
      AND pg_catalog.cardinality(stone_options) = pg_catalog.cardinality(
        pg_catalog.string_to_array(pg_catalog.array_to_string(stone_options, ','), ','))
      AND pg_catalog.array_to_string(stone_options, ',') ~ '^[a-z0-9][a-z0-9-]{0,39}(,[a-z0-9][a-z0-9-]{0,39})*$'
    )
  );

DO $migration$
DECLARE
  target regprocedure := 'public.ecommerce_create_checkout(jsonb,jsonb,text,text)'::regprocedure;
  old_metadata jsonb;
  original text;
  patched text;
  legacy_block text := $legacy$    if v_category = 'Alianças' then
      if v_quantity <> 1 then
        raise exception
          using
            errcode = '22023',
            message = 'An alliance pair must have quantity 1';
      end if;

      if public.ecommerce_valid_ring_pair(v_customization)
         is not true then
        raise exception
          using
            errcode = '22023',
            message = 'Alliance pair customization is invalid';
      end if;
    elsif v_customization is not null then
      raise exception
        using
          errcode = '22023',
          message = 'Customization is not supported for this product';
    end if;$legacy$;
  stone_block text := $stone$    declare
      v_stone_enabled boolean;
      v_stone_options text[];
      v_stone_product_eligible boolean;
      v_ring_customization jsonb := v_customization;
    begin
      select p.stone_customization_enabled, p.stone_options,
        p.is_active and p.price > 0 and p.stock_status in ('available', 'made_to_order')
        and p.slug = pg_catalog.btrim(v_item ->> 'product_slug')
        and pg_catalog.count(*) over () = 1
        and exists (select 1 from public.ecommerce_categories c
                    where c.id = p.category_id and c.is_active and c.name = v_category)
        and exists (select 1 from public.ecommerce_materials m where m.id = p.material_id and m.is_active)
        and (p.subcategory_id is null or exists (select 1 from public.ecommerce_subcategories s
                    where s.id = p.subcategory_id and s.category_id = p.category_id and s.is_active))
        and exists (select 1 from public.ecommerce_product_images i where i.product_id = p.id and i.is_primary)
        and p.sale_unit = case when v_category = 'Alianças' then 'pair' else 'unit' end
      into v_stone_enabled, v_stone_options, v_stone_product_eligible
      from public.ecommerce_products p
      where p.legacy_id = pg_catalog.btrim(v_item ->> 'product_id')
        or (p.legacy_id is null and p.id::text = pg_catalog.btrim(v_item ->> 'product_id'))
      order by p.stone_customization_enabled desc, p.id
      limit 1;

      if v_stone_enabled is true or v_customization ? 'stone_color'
         or v_customization -> 'type' = '"stone"'::jsonb then
        if v_stone_enabled is not true or v_stone_product_eligible is not true
           or pg_catalog.jsonb_typeof(v_customization) is distinct from 'object'
           or pg_catalog.jsonb_typeof(v_customization -> 'stone_color') is distinct from 'string'
           or not coalesce((v_customization ->> 'stone_color') = any (v_stone_options), false) then
          raise exception using errcode = '22023', message = 'Invalid stone customization';
        end if;

        if v_category = 'Alianças' then
          if v_customization - array['type', 'ring1', 'ring2', 'stone_color'] <> '{}'::jsonb
             or pg_catalog.jsonb_typeof(v_customization -> 'ring1') is distinct from 'object'
             or pg_catalog.jsonb_typeof(v_customization -> 'ring2') is distinct from 'object'
             or (v_customization -> 'ring1') - array['size', 'engraving'] <> '{}'::jsonb
             or (v_customization -> 'ring2') - array['size', 'engraving'] <> '{}'::jsonb then
            raise exception using errcode = '22023', message = 'Invalid stone customization';
          end if;
          v_ring_customization := v_customization - 'stone_color';
        elsif v_customization -> 'type' is distinct from '"stone"'::jsonb
           or v_customization - array['type', 'stone_color'] <> '{}'::jsonb then
          raise exception using errcode = '22023', message = 'Invalid stone customization';
        end if;
      end if;

      if v_category = 'Alianças' then
        if v_quantity <> 1 then
          raise exception
            using
              errcode = '22023',
              message = 'An alliance pair must have quantity 1';
        end if;

        if public.ecommerce_valid_ring_pair(v_ring_customization)
           is not true then
          raise exception
            using
              errcode = '22023',
              message = 'Alliance pair customization is invalid';
        end if;
      elsif v_customization is not null and v_stone_enabled is not true then
        raise exception
          using
            errcode = '22023',
            message = 'Customization is not supported for this product';
      end if;
    end;$stone$;
BEGIN
  SELECT pg_catalog.to_jsonb(p) - 'prosrc', pg_catalog.pg_get_functiondef(p.oid)
    INTO STRICT old_metadata, original FROM pg_catalog.pg_proc p WHERE p.oid = target;
  IF pg_catalog.md5(pg_catalog.replace(original, E'\r\n', E'\n')) <> '2b732ad0c4fa163ba4417ae428f29ee4'
     OR old_metadata ->> 'prosecdef' <> 'true'
     OR (SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid = target) <> 'postgres'
     OR (SELECT p.proconfig FROM pg_catalog.pg_proc p WHERE p.oid = target) IS DISTINCT FROM ARRAY['search_path=""']
     OR NOT pg_catalog.has_function_privilege('service_role', target, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', target, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', target, 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected ecommerce_create_checkout baseline or privileges';
  END IF;

  -- Preserve the installed line endings as well as all non-item logic.
  legacy_block := pg_catalog.replace(legacy_block, E'\r\n', E'\n');
  stone_block := pg_catalog.replace(stone_block, E'\r\n', E'\n');
  IF pg_catalog.strpos(original, legacy_block) = 0 THEN
    legacy_block := pg_catalog.replace(legacy_block, E'\n', E'\r\n');
    stone_block := pg_catalog.replace(stone_block, E'\n', E'\r\n');
  END IF;
  patched := pg_catalog.replace(original, legacy_block, stone_block);
  IF pg_catalog.length(patched) - pg_catalog.length(original) <>
      pg_catalog.length(stone_block) - pg_catalog.length(legacy_block) THEN
    RAISE EXCEPTION 'Expected exactly one checkout item-validation block';
  END IF;
  EXECUTE patched;
  IF (SELECT pg_catalog.to_jsonb(p) - 'prosrc' FROM pg_catalog.pg_proc p WHERE p.oid = target)
       IS DISTINCT FROM old_metadata THEN
    RAISE EXCEPTION 'Checkout function metadata changed';
  END IF;
END;
$migration$;

COMMIT;
