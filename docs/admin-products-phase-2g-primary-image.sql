-- Fase 2G: troca transacional da imagem principal.
-- Executar uma vez no SQL Editor do mesmo projeto Supabase do ecommerce.
-- Nao altera produtos, imagens existentes, RLS ou outras tabelas.
begin;

create or replace function public.ecommerce_set_product_primary_image(
  p_product_id uuid,
  p_image_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.ecommerce_is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  -- Serializa duas trocas concorrentes sem ampliar os privilegios do chamador.
  perform 1
  from public.ecommerce_products
  where id = p_product_id
  for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.ecommerce_product_images
  where id = p_image_id and product_id = p_product_id
  for update;
  if not found then
    raise exception 'image not found for product' using errcode = 'P0002';
  end if;

  -- O indice parcial unico nao e adiavel: libera a imagem antiga primeiro.
  -- O constraint trigger existente valida a imagem principal ao fim da transacao.
  update public.ecommerce_product_images
  set is_primary = false
  where product_id = p_product_id and is_primary = true and id <> p_image_id;

  update public.ecommerce_product_images
  set is_primary = true
  where id = p_image_id and product_id = p_product_id;

  if (select count(*) from public.ecommerce_product_images
      where product_id = p_product_id and is_primary = true) <> 1 then
    raise exception 'exactly one primary image required' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.ecommerce_set_product_primary_image(uuid, uuid) from public, anon;
grant execute on function public.ecommerce_set_product_primary_image(uuid, uuid) to authenticated;

commit;
