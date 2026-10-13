"use server";

import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { revalidateAdminProduct } from "@/lib/admin/revalidate";

const uuid = z.string().uuid();
type ImageActionResult = { ok: true } | { ok: false; error: string };

async function finishImageEdit(
  supabase: Awaited<ReturnType<typeof requireActiveAdmin>>["supabase"],
  productId: string
): Promise<ImageActionResult> {
  // The product trigger records the admin and increments version for the shadow audit.
  const { error } = await supabase.from("ecommerce_products")
    .update({ updated_at: new Date().toISOString() }).eq("id", productId);
  revalidateAdminProduct(productId);
  return error
    ? { ok: false, error: "Imagem alterada, mas não foi possível registrar a revisão do produto. Atualize a página." }
    : { ok: true };
}

async function imageContext(productId: string, imageId: string) {
  const { supabase } = await requireActiveAdmin();
  const { data, error } = await supabase.from("ecommerce_product_images")
    .select("id,product_id,path,source_type,sort_order,is_primary,alt_text")
    .eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (error || !data) return null;
  return { supabase, image: data };
}

export async function refreshProductImagesAction(productId: string): Promise<ImageActionResult> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Produto inválido." };
  const { supabase } = await requireActiveAdmin();
  const { data, error } = await supabase.from("ecommerce_products").select("id").eq("id", productId).maybeSingle();
  if (error || !data) return { ok: false, error: "Produto não encontrado." };
  return finishImageEdit(supabase, productId);
}

export async function setPrimaryImageAction(productId: string, imageId: string): Promise<ImageActionResult> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) {
    return { ok: false, error: "Imagem inválida." };
  }
  const context = await imageContext(productId, imageId);
  if (!context) return { ok: false, error: "Imagem não encontrada." };
  const { error } = await context.supabase.rpc("ecommerce_set_product_primary_image", {
    p_product_id: productId,
    p_image_id: imageId
  });
  if (error) return { ok: false, error: "Não foi possível definir a imagem principal. Confirme que a RPC foi instalada." };
  return finishImageEdit(context.supabase, productId);
}

export async function moveProductImageAction(
  productId: string,
  imageId: string,
  direction: "up" | "down"
): Promise<ImageActionResult> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success ||
      !["up", "down"].includes(direction)) return { ok: false, error: "Imagem inválida." };
  const { supabase } = await requireActiveAdmin();
  const { data: images, error } = await supabase.from("ecommerce_product_images")
    .select("id,product_id,path,source_type,sort_order,is_primary,alt_text")
    .eq("product_id", productId).order("sort_order");
  if (error || !images) return { ok: false, error: "Não foi possível consultar as imagens." };
  const index = images.findIndex((image) => image.id === imageId);
  const neighbor = images[index + (direction === "up" ? -1 : 1)];
  const current = images[index];
  if (!current || !neighbor) return { ok: false, error: "A imagem já está no limite da ordem." };

  // Both rows are updated in one statement; the existing order constraint is deferred.
  const { error: updateError } = await supabase.from("ecommerce_product_images").upsert([
    { ...current, sort_order: neighbor.sort_order },
    { ...neighbor, sort_order: current.sort_order }
  ], { onConflict: "id" });
  if (updateError) return { ok: false, error: "Não foi possível reorganizar as imagens." };
  return finishImageEdit(supabase, productId);
}

export async function updateProductImageAltAction(
  productId: string,
  imageId: string,
  altText: string
): Promise<ImageActionResult> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success || altText.length > 180) {
    return { ok: false, error: "Descrição da imagem inválida." };
  }
  const context = await imageContext(productId, imageId);
  if (!context) return { ok: false, error: "Imagem não encontrada." };
  const { error } = await context.supabase.from("ecommerce_product_images")
    .update({ alt_text: altText.trim() || null }).eq("id", imageId).eq("product_id", productId);
  if (error) return { ok: false, error: "Não foi possível salvar a descrição da imagem." };
  return finishImageEdit(context.supabase, productId);
}

export async function removeProductImageAction(productId: string, imageId: string): Promise<ImageActionResult> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) {
    return { ok: false, error: "Imagem inválida." };
  }
  const context = await imageContext(productId, imageId);
  if (!context) return { ok: false, error: "Imagem não encontrada." };
  const { data: product, error: readError } = await context.supabase.from("ecommerce_products")
    .select("is_active").eq("id", productId).maybeSingle();
  if (readError || !product) return { ok: false, error: "Produto não encontrado." };
  if (context.image.is_primary && product.is_active) {
    return { ok: false, error: "Escolha outra imagem principal antes de remover esta." };
  }
  const { error } = await context.supabase.from("ecommerce_product_images")
    .delete().eq("id", imageId).eq("product_id", productId);
  if (error) return { ok: false, error: "Não foi possível remover a imagem." };
  // Do not remove the Storage object here: a failed storage call would leave a broken catalog URL.
  return finishImageEdit(context.supabase, productId);
}
