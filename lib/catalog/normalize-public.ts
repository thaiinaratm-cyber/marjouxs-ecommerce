import { formatCurrency } from "@/lib/format";
import type { DatabaseCatalog, DatabaseProduct } from "@/lib/catalog/database-products";
import { catalogImageUrl } from "@/lib/catalog/image-url";
import { CatalogDataError } from "@/lib/catalog/resolve";
import type { CategoryName, Product, StockStatus } from "@/types/product";

function money(value: number | string | null, field: string): number | null {
  if (value === null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) / 100 !== amount) {
    throw new CatalogDataError(`invalid_${field}`);
  }
  return amount;
}

function stockStatus(row: DatabaseProduct, legacy?: Product): StockStatus {
  switch (row.stock_status) {
    case "available": return "Disponível";
    case "unavailable": return "Indisponível";
    case "service": return "Serviço";
    case "made_to_order":
      // The migration also detected this phrase in descriptions. Keep the legacy
      // card badge unchanged unless the structured data or description changed.
      return legacy?.stockStatus === "Disponível" && !row.updated_by &&
        !row.is_custom_order && row.description === legacy.description
        ? "Disponível"
        : "Sob encomenda";
    default: throw new CatalogDataError("invalid_stock_status");
  }
}

export function normalizePublicDatabaseCatalog(
  catalog: DatabaseCatalog,
  legacyProducts: Product[],
  supabaseUrl?: string
): Product[] {
  if (!Array.isArray(catalog.products) || !Array.isArray(catalog.images)) {
    throw new CatalogDataError("invalid_catalog_shape");
  }

  const legacyById = new Map(legacyProducts.map((product) => [product.id, product]));
  const order = new Map(legacyProducts.map((product, index) => [product.id, index]));
  const categories = new Map(catalog.categories.map((row) => [row.id, row]));
  const subcategories = new Map(catalog.subcategories.map((row) => [row.id, row]));
  const materials = new Map(catalog.materials.map((row) => [row.id, row]));
  const imagesByProduct = new Map<string, typeof catalog.images>();
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const image of catalog.images) {
    const images = imagesByProduct.get(image.product_id) ?? [];
    images.push(image);
    imagesByProduct.set(image.product_id, images);
  }

  const products: Product[] = [];
  for (const row of catalog.products) {
    if (!row.is_active) continue;
    const publicId = row.legacy_id ?? row.id;
    const legacy = row.legacy_id ? legacyById.get(row.legacy_id) : undefined;
    const category = row.category_id ? categories.get(row.category_id) : null;
    const subcategory = row.subcategory_id ? subcategories.get(row.subcategory_id) : null;
    const material = row.material_id ? materials.get(row.material_id) : null;
    if (!category?.is_active || !material?.is_active ||
        (row.subcategory_id && (!subcategory?.is_active || subcategory.category_id !== category.id)) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || !row.name?.trim() ||
        seenIds.has(publicId) || seenSlugs.has(row.slug)) {
      throw new CatalogDataError("invalid_public_product");
    }

    const productImages = [...(imagesByProduct.get(row.id) ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
    const imageUrls = productImages.map((image) => catalogImageUrl(image, supabaseUrl));
    if (productImages.length === 0 || productImages.filter((image) => image.is_primary).length !== 1 ||
        imageUrls.some((url) => !url)) {
      throw new CatalogDataError("invalid_public_image");
    }

    const price = money(row.price, "price");
    const oldPrice = money(row.old_price, "old_price");
    const discountPercent = money(row.discount_percent, "discount_percent");
    const cashDiscountPercent = money(row.cash_discount_percent, "cash_discount_percent");
    if (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string") ||
        !["pair", "unit"].includes(row.sale_unit) ||
        (category.name === "Alianças" && (row.sale_unit !== "pair" ||
          row.size_min === null || row.size_min < 8 || row.size_max === null || row.size_max > 35 ||
          row.size_min > row.size_max)) ||
        (category.name !== "Alianças" && row.sale_unit !== "unit") ||
        (row.engraving_included && !row.engraving_available)) {
      throw new CatalogDataError("invalid_public_commercial_fields");
    }

    products.push({
      id: publicId,
      name: row.name,
      slug: row.slug,
      category: category.name as CategoryName,
      subcategory: subcategory?.name ?? "",
      material: material.name,
      price,
      oldPrice,
      discountPercent,
      cashDiscountPercent,
      installmentsCount: row.installments_count,
      priceLabel: price === null
        ? row.price_label_override && !/^R\$/i.test(row.price_label_override.trim())
          ? row.price_label_override
          : "Preço sob consulta"
        : formatCurrency(price),
      installments: row.installments_text_override ?? "",
      description: row.description,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      imageAlt: productImages[0].alt_text,
      tags: row.tags,
      images: imageUrls as string[],
      featured: row.is_featured,
      isCustomOrder: row.is_custom_order,
      allowWhatsappQuote: row.allow_whatsapp_quote,
      stockStatus: stockStatus(row, legacy),
      saleUnit: row.sale_unit as "pair" | "unit",
      engravingAvailable: row.engraving_available,
      engravingIncluded: row.engraving_included,
      jewelryBoxIncluded: row.jewelry_box_included,
      sizeMin: row.size_min,
      sizeMax: row.size_max
    });
    seenIds.add(publicId);
    seenSlugs.add(row.slug);
  }

  return products.sort((a, b) =>
    (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.name.localeCompare(b.name, "pt-BR")
  );
}
