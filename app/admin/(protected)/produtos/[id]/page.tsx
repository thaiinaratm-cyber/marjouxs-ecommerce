import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Save } from "lucide-react";
import {
  activateProductAction,
  deactivateProductAction,
  updateProductAction
} from "@/app/admin/(protected)/produtos/actions";
import { DeactivateProductForm } from "@/components/admin/deactivate-product-form";
import { ProductFields } from "@/components/admin/product-fields";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { ProductImageUpload } from "@/components/admin/product-image-upload";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getAdminTaxonomy } from "@/lib/admin/catalog";
import { ADMIN_PRODUCT_IMAGE_BUCKET } from "@/lib/admin/product-form";

const errors: Record<string, string> = {
  activation: "Não foi possível ativar o produto.",
  activation_check: "Não foi possível concluir as validações para ativação.",
  deactivation: "Não foi possível desativar o produto.",
  duplicate: "Já existe um produto com este slug.",
  incomplete_product: "Complete os dados obrigatórios antes de ativar.",
  invalid_fields: "Revise os campos obrigatórios.",
  invalid_commercial_fields: "Revise unidade de venda, numeração e gravação antes de salvar o produto publicado.",
  invalid_price: "Informe um preço válido em reais ou deixe o campo vazio.",
  primary_image_required: "Adicione uma imagem principal antes de ativar.",
  save: "Não foi possível salvar as alterações.",
  version_conflict: "Este produto foi alterado em outra sessão. Recarregue a página antes de salvar.",
  taxonomy: "A categoria, subcategoria ou material selecionado não é válido."
};

type ProductDetailPageProps = {
  params: { id: string };
  searchParams?: Record<string, string | undefined>;
};

export default async function AdminProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { supabase } = await requireActiveAdmin();
  const [productResult, imagesResult, taxonomy] = await Promise.all([
    supabase.from("ecommerce_products").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("ecommerce_product_images")
      .select("id,path,alt_text,is_primary,sort_order,source_type")
      .eq("product_id", params.id)
      .order("sort_order"),
    getAdminTaxonomy(supabase)
  ]);

  if (productResult.error || !productResult.data) notFound();
  if (imagesResult.error) throw new Error("admin_product_images_unavailable");

  const product = productResult.data;
  const images = imagesResult.data ?? [];
  const error = searchParams?.error ? errors[searchParams.error] : null;
  const success = searchParams?.created
    ? "Rascunho criado. Agora adicione a imagem principal."
    : searchParams?.saved
      ? "Alterações salvas."
      : searchParams?.activated
        ? "Produto ativado após as validações."
        : searchParams?.deactivated
          ? "Produto movido para rascunho."
          : searchParams?.image
            ? "Imagens atualizadas."
          : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/produtos" className="inline-flex items-center gap-2 text-sm font-semibold text-taupe transition hover:text-gold">
        <ArrowLeft size={16} aria-hidden="true" /> Voltar aos produtos
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Produto administrativo</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">{product.name}</h1>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${product.is_active ? "bg-green-100 text-green-800" : "bg-black/5 text-taupe"}`}>
          {product.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
          {product.is_active ? "Publicado" : "Rascunho/Inativo"}
        </span>
      </div>

      {error ? <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div> : null}
      {success ? <div className="mt-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{success}</div> : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form action={updateProductAction} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="version" value={product.version} />
          <ProductFields
            taxonomy={taxonomy}
            values={{
              name: product.name,
              slug: product.slug,
              categoryId: product.category_id,
              subcategoryId: product.subcategory_id,
              materialId: product.material_id,
              price: product.price,
              oldPrice: product.old_price,
              discountPercent: product.discount_percent,
              cashDiscountPercent: product.cash_discount_percent,
              installmentsCount: product.installments_count,
              shortDescription: product.short_description,
              description: product.description,
              seoTitle: product.seo_title,
              seoDescription: product.seo_description,
              approximateWeightGrams: product.approximate_weight_grams,
              widthMm: product.width_mm,
              thicknessMm: product.thickness_mm,
              heightMm: product.height_mm,
              lengthCm: product.length_cm,
              diameterMm: product.diameter_mm,
              finish: product.finish,
              stoneType: product.stone_type,
              stoneColor: product.stone_color,
              stoneQuantity: product.stone_quantity,
              materialDetails: product.material_details,
              genderStyle: product.gender_style,
              technicalNotes: product.technical_notes,
              sizeMin: product.size_min,
              sizeMax: product.size_max,
              stockStatus: product.stock_status,
              saleUnit: product.sale_unit,
              isCustomOrder: product.is_custom_order,
              engravingAvailable: product.engraving_available,
              engravingIncluded: product.engraving_included,
              jewelryBoxIncluded: product.jewelry_box_included,
              isFeatured: product.is_featured,
              allowWhatsappQuote: product.allow_whatsapp_quote
            }}
          />
          <div className="mt-7 flex justify-end">
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-gold">
              <Save size={17} aria-hidden="true" /> Salvar alterações
            </button>
          </div>
        </form>

        <aside className="grid content-start gap-5">
          <ProductImageUpload productId={product.id} productName={product.name} />

          <ProductImageManager productId={product.id} images={images.map((image) => ({
            id: image.id,
            url: image.source_type === "storage"
              ? supabase.storage.from(ADMIN_PRODUCT_IMAGE_BUCKET).getPublicUrl(image.path).data.publicUrl
              : image.path,
            altText: image.alt_text,
            isPrimary: image.is_primary
          }))} />

          <div className="rounded-lg border border-black/10 bg-champagne/55 p-5">
            <h2 className="font-serif text-xl font-semibold text-ink">Publicação</h2>
            <p className="mt-2 text-sm leading-6 text-taupe">
              A publicação exige dados comerciais válidos e uma imagem principal. Produtos sem preço permanecem sob consulta.
            </p>
            {product.is_active ? (
              <DeactivateProductForm productId={product.id} action={deactivateProductAction} />
            ) : (
              <form action={activateProductAction} className="mt-4">
                <input type="hidden" name="productId" value={product.id} />
                <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-4 text-sm font-bold text-white transition hover:bg-ink">
                  <CheckCircle2 size={17} aria-hidden="true" /> Validar e publicar
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
