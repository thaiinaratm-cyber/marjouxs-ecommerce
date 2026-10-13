import type { DatabaseProduct, DatabaseProductImage } from "@/lib/catalog/database-products";
import { catalogImageUrl } from "@/lib/catalog/image-url";
import {
  CheckoutValidationError,
  resolveCheckoutCart,
  resolveShipmentCart,
  type CheckoutProductRecord,
  type CheckoutProductResolver
} from "@/lib/checkout/catalog";
import { getCheckoutCatalogSource } from "@/lib/checkout/config";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import type { CartLineInput, ShippingLineInput } from "@/types/checkout";
import type { CategoryName, Product, StockStatus } from "@/types/product";

type CheckoutProductRow = Pick<DatabaseProduct,
  "id" | "legacy_id" | "name" | "slug" | "category_id" | "subcategory_id" | "material_id" |
  "price" | "stock_status" | "sale_unit" | "is_active" | "engraving_available" | "size_min" | "size_max"
>;
type TaxonomyRow = { id: string; name: string; is_active: boolean };
type SubcategoryRow = TaxonomyRow & { category_id: string };
type PrimaryImageRow = Pick<DatabaseProductImage, "product_id" | "path" | "source_type" | "is_primary">;

export type CheckoutCatalogSnapshot = {
  products: CheckoutProductRow[];
  categories: TaxonomyRow[];
  subcategories: SubcategoryRow[];
  materials: TaxonomyRow[];
  images: PrimaryImageRow[];
};

export class CheckoutCatalogReadError extends Error {
  constructor() {
    super("Não foi possível consultar o catálogo do checkout.");
    this.name = "CheckoutCatalogReadError";
  }
}

const PRODUCT_COLUMNS = [
  "id", "legacy_id", "name", "slug", "category_id", "subcategory_id", "material_id",
  "price", "stock_status", "sale_unit", "is_active", "engraving_available", "size_min", "size_max"
].join(",");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicProductId(row: CheckoutProductRow) {
  return row.legacy_id ?? row.id;
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function readCheckoutDatabaseProducts(
  ids: string[],
  expectedLines?: ShippingLineInput[]
): Promise<CheckoutCatalogSnapshot> {
  if (ids.length === 0) {
    return { products: [], categories: [], subcategories: [], materials: [], images: [] };
  }

  try {
    const client = getSupabaseAdmin();
    const uuidIds = ids.filter((id) => UUID.test(id));
    const [legacyResult, manualResult] = await Promise.all([
      client.from("ecommerce_products").select(PRODUCT_COLUMNS)
        .in("legacy_id", ids).abortSignal(AbortSignal.timeout(8000)),
      uuidIds.length
        ? client.from("ecommerce_products").select(PRODUCT_COLUMNS)
          .in("id", uuidIds).abortSignal(AbortSignal.timeout(8000))
        : Promise.resolve({ data: [], error: null })
    ]);
    if (legacyResult.error || manualResult.error || !Array.isArray(legacyResult.data) ||
        !Array.isArray(manualResult.data)) throw new CheckoutCatalogReadError();
    const returnedRows = [...legacyResult.data, ...manualResult.data] as unknown as CheckoutProductRow[];
    const products = Array.from(new Map(
      returnedRows.map((row) => [row.id, row])
    ).values());
    if (expectedLines) {
      const byProductId = new Map(products.map((row) => [publicProductId(row), row]));
      for (const line of expectedLines) {
        const row = byProductId.get(line.productId);
        if (!row || !row.is_active ||
            !["available", "made_to_order"].includes(row.stock_status)) unavailable();
        if (row.price === null) {
          throw new CheckoutValidationError("Este produto está disponível somente por atendimento.", "product_without_price");
        }
        decimalCents(row.price, row.slug);
      }
    }
    if (products.length === 0) {
      return { products, categories: [], subcategories: [], materials: [], images: [] };
    }

    const categoryIds = unique(products.map((row) => row.category_id));
    const subcategoryIds = unique(products.map((row) => row.subcategory_id));
    const materialIds = unique(products.map((row) => row.material_id));

    const [categoryResult, subcategoryResult, materialResult, imageResult] = await Promise.all([
      categoryIds.length
        ? client.from("ecommerce_categories").select("id,name,is_active")
          .in("id", categoryIds).abortSignal(AbortSignal.timeout(8000))
        : Promise.resolve({ data: [], error: null }),
      subcategoryIds.length
        ? client.from("ecommerce_subcategories").select("id,category_id,name,is_active")
          .in("id", subcategoryIds).abortSignal(AbortSignal.timeout(8000))
        : Promise.resolve({ data: [], error: null }),
      materialIds.length
        ? client.from("ecommerce_materials").select("id,name,is_active")
          .in("id", materialIds).abortSignal(AbortSignal.timeout(8000))
        : Promise.resolve({ data: [], error: null }),
      client.from("ecommerce_product_images").select("product_id,path,source_type,is_primary")
        .in("product_id", products.map((row) => row.id))
        .eq("is_primary", true).abortSignal(AbortSignal.timeout(8000))
    ]);
    if (categoryResult.error || subcategoryResult.error || materialResult.error || imageResult.error ||
        !categoryResult.data || !subcategoryResult.data || !materialResult.data || !imageResult.data) {
      throw new CheckoutCatalogReadError();
    }

    return {
      products,
      categories: categoryResult.data as TaxonomyRow[],
      subcategories: subcategoryResult.data as SubcategoryRow[],
      materials: materialResult.data as TaxonomyRow[],
      images: imageResult.data as PrimaryImageRow[]
    };
  } catch (error) {
    if (error instanceof CheckoutValidationError) throw error;
    throw new CheckoutCatalogReadError();
  }
}

function decimalCents(value: number | string | null, slug: string) {
  if (value === null) return null;
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2})(0*))?$/);
  if (!match) {
    throw new CheckoutValidationError("O preço deste produto está indisponível.", "invalid_catalog_price", 409);
  }
  const cents = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents <= BigInt(0)) {
    throw new CheckoutValidationError(`O preço de ${slug} está indisponível.`, "invalid_catalog_price", 409);
  }
  return Number(cents);
}

function unavailable(): never {
  console.info("checkout_catalog", JSON.stringify({ checkout_product_unavailable: true }));
  throw new CheckoutValidationError("Um produto não está mais disponível para compra.", "product_unavailable", 409);
}

function databaseResolver(snapshot: CheckoutCatalogSnapshot): CheckoutProductResolver {
  const rows = new Map(snapshot.products.map((row) => [publicProductId(row), row]));
  const categories = new Map(snapshot.categories.map((row) => [row.id, row]));
  const subcategories = new Map(snapshot.subcategories.map((row) => [row.id, row]));
  const materials = new Map(snapshot.materials.map((row) => [row.id, row]));
  const images = new Map<string, PrimaryImageRow[]>();
  for (const image of snapshot.images) {
    images.set(image.product_id, [...(images.get(image.product_id) ?? []), image]);
  }

  return (productId, productSlug): CheckoutProductRecord => {
    const row = rows.get(productId);
    if (!row || publicProductId(row) !== productId || !row.is_active || !row.name) unavailable();
    const category = row.category_id ? categories.get(row.category_id) : null;
    const subcategory = row.subcategory_id ? subcategories.get(row.subcategory_id) : null;
    const material = row.material_id ? materials.get(row.material_id) : null;
    const primaryImages = images.get(row.id) ?? [];
    const imageUrl = primaryImages.length === 1
      ? catalogImageUrl(primaryImages[0], process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
      : null;
    if (!category?.is_active || !material?.is_active ||
        (row.subcategory_id && (!subcategory?.is_active || subcategory.category_id !== category.id)) ||
        primaryImages.length !== 1 || !imageUrl ||
        !primaryImages[0].is_primary ||
        !["available", "made_to_order"].includes(row.stock_status) ||
        (category.name === "Alianças"
          ? row.sale_unit !== "pair" || row.size_min === null || row.size_min < 8 ||
            row.size_max === null || row.size_max > 35 || row.size_min > row.size_max
          : row.sale_unit !== "unit")) unavailable();

    const unitPriceCents = decimalCents(row.price, row.slug);
    const stockStatus: StockStatus = row.stock_status === "made_to_order" ? "Sob encomenda" : "Disponível";
    const product: Product = {
      id: publicProductId(row),
      name: row.name,
      slug: row.slug,
      category: category.name as CategoryName,
      subcategory: subcategory?.name ?? "",
      material: material.name,
      price: unitPriceCents === null ? null : unitPriceCents / 100,
      priceLabel: "",
      installments: "",
      description: "",
      images: [imageUrl],
      featured: false,
      isCustomOrder: false,
      allowWhatsappQuote: false,
      stockStatus,
      saleUnit: row.sale_unit as "pair" | "unit",
      engravingAvailable: row.engraving_available,
      sizeMin: row.size_min,
      sizeMax: row.size_max
    };
    return { product, ...(unitPriceCents === null ? {} : { unitPriceCents }) };
  };
}

type CatalogOptions = {
  env?: Record<string, string | undefined>;
  readDatabase?: (ids: string[], lines?: ShippingLineInput[]) => Promise<CheckoutCatalogSnapshot>;
};

async function getResolver(lines: ShippingLineInput[], options: CatalogOptions) {
  const source = getCheckoutCatalogSource(options.env);
  if (source === "static") {
    console.info("checkout_catalog", JSON.stringify({ checkout_catalog_source: "static" }));
    return undefined;
  }

  try {
    const ids = unique(lines.map((line) => line.productId));
    let snapshot: CheckoutCatalogSnapshot;
    try {
      snapshot = await (options.readDatabase ?? readCheckoutDatabaseProducts)(ids, lines);
    } catch (error) {
      if (error instanceof CheckoutValidationError) throw error;
      throw new CheckoutCatalogReadError();
    }
    if (!Array.isArray(snapshot.products) || !Array.isArray(snapshot.images) ||
        !Array.isArray(snapshot.categories) || !Array.isArray(snapshot.subcategories) ||
        !Array.isArray(snapshot.materials)) throw new CheckoutCatalogReadError();
    console.info("checkout_catalog", JSON.stringify({ checkout_catalog_source: "database" }));
    return databaseResolver(snapshot);
  } catch (error) {
    if (!(error instanceof CheckoutCatalogReadError)) throw error;
    // Once the database is authoritative, static data cannot prove a product is still active.
    throw error;
  }
}

export async function resolveAuthoritativeCheckoutCart(
  lines: CartLineInput[],
  priceChangePolicy: "reject" | "report" = "reject",
  options: CatalogOptions = {}
) {
  const resolver = await getResolver(lines, options);
  try {
    const cart = resolveCheckoutCart(lines, resolver, priceChangePolicy);
    if (priceChangePolicy === "reject" && getCheckoutCatalogSource(options.env) === "database") {
      const missingIndex = lines.findIndex((line) => line.displayedUnitPriceCents === undefined);
      if (missingIndex >= 0) {
        const item = cart.items[missingIndex];
        throw new CheckoutValidationError(
          "Revise o preço atual antes de continuar.",
          "price_changed",
          409,
          { productSlug: item.productSlug, currentPriceCents: item.unitPriceCents }
        );
      }
    }
    if (cart.priceChanges?.length) {
      console.info("checkout_catalog", JSON.stringify({ checkout_price_changed: true }));
    }
    return cart;
  } catch (error) {
    if (error instanceof CheckoutValidationError && error.code === "price_changed") {
      console.info("checkout_catalog", JSON.stringify({ checkout_price_changed: true }));
    }
    throw error;
  }
}

export async function resolveAuthoritativeShipmentCart(lines: ShippingLineInput[], options: CatalogOptions = {}) {
  const resolver = await getResolver(lines, options);
  return resolveShipmentCart(lines, resolver);
}
