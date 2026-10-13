"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { revalidateAdminProduct } from "@/lib/admin/revalidate";
import { catalogImageUrl } from "@/lib/catalog/image-url";
import {
  parseAdminProductForm,
  validateProductActivation,
  type AdminProductInput
} from "@/lib/admin/product-form";

const productIdSchema = z.string().uuid();

function productPayload(input: AdminProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    material_id: input.materialId,
    price: input.price,
    old_price: input.oldPrice,
    discount_percent: input.discountPercent,
    cash_discount_percent: input.cashDiscountPercent,
    installments_count: input.installmentsCount,
    short_description: input.shortDescription,
    description: input.description,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    approximate_weight_grams: input.approximateWeightGrams,
    width_mm: input.widthMm,
    thickness_mm: input.thicknessMm,
    height_mm: input.heightMm,
    length_cm: input.lengthCm,
    diameter_mm: input.diameterMm,
    finish: input.finish,
    stone_type: input.stoneType,
    stone_color: input.stoneColor,
    stone_quantity: input.stoneQuantity,
    material_details: input.materialDetails,
    gender_style: input.genderStyle,
    technical_notes: input.technicalNotes,
    size_min: input.sizeMin,
    size_max: input.sizeMax,
    stock_status: input.stockStatus,
    sale_unit: input.saleUnit,
    is_custom_order: input.isCustomOrder,
    engraving_available: input.engravingAvailable,
    engraving_included: input.engravingIncluded,
    jewelry_box_included: input.jewelryBoxIncluded,
    is_featured: input.isFeatured,
    allow_whatsapp_quote: input.allowWhatsappQuote
  };
}

function productFormError(error: { code?: string } | null) {
  return error?.code === "23505" ? "duplicate" : "save";
}

async function taxonomyValidation(
  supabase: Awaited<ReturnType<typeof requireActiveAdmin>>["supabase"],
  input: AdminProductInput
) {
  const [categoryResult, materialResult] = await Promise.all([
    supabase
      .from("ecommerce_categories")
      .select("id,name")
      .eq("id", input.categoryId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("ecommerce_materials")
      .select("id")
      .eq("id", input.materialId)
      .eq("is_active", true)
      .maybeSingle()
  ]);

  if (categoryResult.error || materialResult.error || !categoryResult.data || !materialResult.data) {
    return null;
  }

  if (!input.subcategoryId) return categoryResult.data.name;

  const { data, error } = await supabase
    .from("ecommerce_subcategories")
    .select("id")
    .eq("id", input.subcategoryId)
    .eq("category_id", input.categoryId)
    .eq("is_active", true)
    .maybeSingle();

  return !error && data ? categoryResult.data.name : null;
}

function commercialValidation(
  product: { stock_status: string; sale_unit: string; size_min: number | null; size_max: number | null; engraving_available: boolean; engraving_included: boolean },
  categoryName: string
) {
  if (product.stock_status === "service" && categoryName !== "Serviços") return false;
  if (categoryName === "Alianças") {
    if (product.sale_unit !== "pair" || product.size_min === null || product.size_max === null ||
        product.size_min < 8 || product.size_max > 35 || product.size_min > product.size_max) return false;
  } else if (product.sale_unit !== "unit") return false;
  return !product.engraving_included || product.engraving_available;
}

export async function createDraftProductAction(formData: FormData) {
  const { supabase } = await requireActiveAdmin();
  const parsed = parseAdminProductForm(formData);
  if (!parsed.success) redirect(`/admin/produtos/novo?error=${parsed.error}`);

  const categoryName = await taxonomyValidation(supabase, parsed.data);
  if (!categoryName) {
    redirect("/admin/produtos/novo?error=taxonomy");
  }

  const { data, error } = await supabase
    .from("ecommerce_products")
    .insert({
      ...productPayload(parsed.data),
      is_active: false
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/admin/produtos/novo?error=${productFormError(error)}`);
  }

  revalidateAdminProduct(data.id);
  redirect(`/admin/produtos/${data.id}?created=1`);
}

export async function updateProductAction(formData: FormData) {
  const productId = productIdSchema.safeParse(formData.get("productId"));
  if (!productId.success) redirect("/admin/produtos?error=invalid_product");

  const { supabase } = await requireActiveAdmin();
  const parsed = parseAdminProductForm(formData);
  if (!parsed.success) redirect(`/admin/produtos/${productId.data}?error=${parsed.error}`);

  const categoryName = await taxonomyValidation(supabase, parsed.data);
  if (!categoryName) {
    redirect(`/admin/produtos/${productId.data}?error=taxonomy`);
  }

  if (parsed.data.version === null) redirect(`/admin/produtos/${productId.data}?error=version_conflict`);
  const { data: current, error: readError } = await supabase
    .from("ecommerce_products")
    .select("is_active")
    .eq("id", productId.data)
    .maybeSingle();
  if (readError || !current) redirect(`/admin/produtos/${productId.data}?error=save`);
  if (current.is_active && !commercialValidation(productPayload(parsed.data), categoryName)) {
    redirect(`/admin/produtos/${productId.data}?error=invalid_commercial_fields`);
  }

  const { data, error } = await supabase
    .from("ecommerce_products")
    .update(productPayload(parsed.data))
    .eq("id", productId.data)
    .eq("version", parsed.data.version)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/admin/produtos/${productId.data}?error=${productFormError(error)}`);
  }
  if (!data) redirect(`/admin/produtos/${productId.data}?error=version_conflict`);

  revalidateAdminProduct(productId.data);
  redirect(`/admin/produtos/${productId.data}?saved=1`);
}

export async function activateProductAction(formData: FormData) {
  const productId = productIdSchema.safeParse(formData.get("productId"));
  if (!productId.success) redirect("/admin/produtos?error=invalid_product");

  const { supabase } = await requireActiveAdmin();
  const [productResult, imageResult] = await Promise.all([
    supabase
      .from("ecommerce_products")
      .select("name,slug,category_id,subcategory_id,material_id,stock_status,sale_unit,size_min,size_max,engraving_available,engraving_included")
      .eq("id", productId.data)
      .maybeSingle(),
    supabase
      .from("ecommerce_product_images")
      .select("id,source_type,path,is_primary")
      .eq("product_id", productId.data)
      .eq("is_primary", true)
  ]);

  if (productResult.error || imageResult.error || !productResult.data) {
    redirect(`/admin/produtos/${productId.data}?error=activation_check`);
  }

  const primaryImages = imageResult.data ?? [];
  const validPrimary = primaryImages.length === 1 && Boolean(catalogImageUrl(primaryImages[0], process.env.NEXT_PUBLIC_SUPABASE_URL));
  const validationError = validateProductActivation(productResult.data, validPrimary);
  if (validationError) {
    redirect(`/admin/produtos/${productId.data}?error=${validationError}`);
  }

  const categoryResult = await supabase.from("ecommerce_categories")
    .select("id,name,is_active").eq("id", productResult.data.category_id).maybeSingle();
  const materialResult = await supabase.from("ecommerce_materials")
    .select("id,is_active").eq("id", productResult.data.material_id).maybeSingle();
  const subcategoryResult = productResult.data.subcategory_id
    ? await supabase.from("ecommerce_subcategories").select("id,category_id,is_active")
      .eq("id", productResult.data.subcategory_id).maybeSingle()
    : null;
  if (categoryResult.error || materialResult.error || subcategoryResult?.error ||
      !categoryResult.data?.is_active || !materialResult.data?.is_active ||
      (productResult.data.subcategory_id && (!subcategoryResult?.data?.is_active ||
        subcategoryResult.data.category_id !== categoryResult.data.id)) ||
      !commercialValidation(productResult.data, categoryResult.data.name)) {
    redirect(`/admin/produtos/${productId.data}?error=activation_check`);
  }

  const { error } = await supabase
    .from("ecommerce_products")
    .update({ is_active: true })
    .eq("id", productId.data);

  if (error) {
    const code = error.code === "23514" ? "primary_image_required" : "activation";
    redirect(`/admin/produtos/${productId.data}?error=${code}`);
  }

  revalidateAdminProduct(productId.data);
  redirect(`/admin/produtos/${productId.data}?activated=1`);
}

export async function deactivateProductAction(formData: FormData) {
  const productId = productIdSchema.safeParse(formData.get("productId"));
  if (!productId.success) redirect("/admin/produtos?error=invalid_product");

  const { supabase } = await requireActiveAdmin();
  const { data, error } = await supabase
    .from("ecommerce_products")
    .update({ is_active: false })
    .eq("id", productId.data)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error || !data) redirect(`/admin/produtos/${productId.data}?error=deactivation`);

  revalidateAdminProduct(productId.data);
  redirect(`/admin/produtos/${productId.data}?deactivated=1`);
}
