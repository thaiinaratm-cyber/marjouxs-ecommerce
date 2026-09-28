import { formatCurrency } from "@/lib/format";
import type { DatabaseCatalog, DatabaseProduct } from "@/lib/catalog/database-products";
import type { CategoryName, Product, StockStatus } from "@/types/product";

function money(value: number | string | null, field: string): number | null {
  if (value === null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) / 100 !== amount) {
    throw new Error(`invalid_${field}`);
  }
  return amount;
}

function stockStatus(row: DatabaseProduct, legacy: Product): StockStatus {
  switch (row.stock_status) {
    case "available": return "Disponível";
    case "unavailable": return "Indisponível";
    case "service": return "Serviço";
    case "made_to_order":
      // The migration also detected this phrase in descriptions. Keep the legacy
      // card badge unchanged unless the structured data or description changed.
      return legacy.stockStatus === "Disponível" &&
        !row.is_custom_order && row.description === legacy.description
        ? "Disponível"
        : "Sob encomenda";
    default: throw new Error("invalid_stock_status");
  }
}

export function normalizePublicDatabaseCatalog(catalog: DatabaseCatalog, legacyProducts: Product[]): Product[] {
  if (!Array.isArray(catalog.products) || !Array.isArray(catalog.images)) {
    throw new Error("invalid_catalog_shape");
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
    if (!row.is_active || !row.legacy_id) continue;
    const legacy = legacyById.get(row.legacy_id);
    const category = row.category_id ? categories.get(row.category_id) : null;
    const subcategory = row.subcategory_id ? subcategories.get(row.subcategory_id) : null;
    const material = row.material_id ? materials.get(row.material_id) : null;
    if (!legacy || !category?.is_active || !subcategory?.is_active || !material?.is_active ||
        subcategory.category_id !== category.id || !row.slug || !row.name ||
        seenIds.has(row.legacy_id) || seenSlugs.has(row.slug)) {
      throw new Error("invalid_public_product");
    }

    const productImages = (imagesByProduct.get(row.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order);
    if (productImages.length === 0 || productImages.filter((image) => image.is_primary).length !== 1 ||
        !productImages[0].is_primary ||
        productImages.some((image) => image.source_type !== "local" || !image.path.startsWith("/produtos/"))) {
      throw new Error("invalid_public_image");
    }

    const price = money(row.price, "price");
    const oldPrice = money(row.old_price, "old_price");
    const discountPercent = money(row.discount_percent, "discount_percent");
    const cashDiscountPercent = money(row.cash_discount_percent, "cash_discount_percent");
    if (price !== legacy.price || row.slug !== legacy.slug) {
      throw new Error("checkout_catalog_mismatch");
    }
    if (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string") ||
        !["pair", "unit"].includes(row.sale_unit) ||
        (category.name === "Alianças" && (row.sale_unit !== "pair" || row.size_min !== 8 || row.size_max !== 35))) {
      throw new Error("invalid_public_commercial_fields");
    }

    products.push({
      id: row.legacy_id,
      name: row.name,
      slug: row.slug,
      category: category.name as CategoryName,
      subcategory: subcategory.name,
      material: material.name,
      price,
      oldPrice,
      discountPercent,
      cashDiscountPercent,
      installmentsCount: row.installments_count,
      priceLabel: row.price_label_override ?? (price === null ? "Sob orçamento" : formatCurrency(price)),
      installments: row.installments_text_override ?? "",
      description: row.description,
      tags: row.tags,
      images: productImages.map((image) => image.path),
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
    seenIds.add(row.legacy_id);
    seenSlugs.add(row.slug);
  }

  return products.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
}
