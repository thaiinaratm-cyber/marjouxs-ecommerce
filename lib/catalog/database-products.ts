import type { SupabaseClient } from "@supabase/supabase-js";

import type { SubcategoryRow, TaxonomyRow } from "@/scripts/migrate-products-to-supabase";

export type DatabaseProduct = {
  id: string;
  legacy_id: string | null;
  name: string;
  slug: string;
  category_id: string | null;
  subcategory_id: string | null;
  material_id: string | null;
  price: number | string | null;
  old_price: number | string | null;
  discount_percent: number | string | null;
  cash_discount_percent: number | string | null;
  installments_count: number | null;
  price_label_override: string | null;
  installments_text_override: string | null;
  description: string;
  tags: string[];
  stock_status: string;
  sale_unit: string;
  is_custom_order: boolean;
  is_active: boolean;
  is_featured: boolean;
  allow_whatsapp_quote: boolean;
  engraving_available: boolean;
  engraving_included: boolean;
  jewelry_box_included: boolean;
  size_min: number | null;
  size_max: number | null;
};

export type DatabaseProductImage = {
  id: string;
  product_id: string;
  source_type: string;
  path: string;
  is_primary: boolean;
  sort_order: number;
};

export type DatabaseCatalog = {
  products: DatabaseProduct[];
  images: DatabaseProductImage[];
  categories: TaxonomyRow[];
  subcategories: SubcategoryRow[];
  materials: TaxonomyRow[];
};

const PAGE_SIZE = 500;
const PRODUCT_COLUMNS = [
  "id", "legacy_id", "name", "slug", "category_id", "subcategory_id", "material_id",
  "price", "old_price", "discount_percent", "cash_discount_percent", "installments_count",
  "price_label_override", "installments_text_override", "description", "tags", "stock_status",
  "sale_unit", "is_custom_order", "is_active", "is_featured", "allow_whatsapp_quote",
  "engraving_available", "engraving_included", "jewelry_box_included", "size_min", "size_max"
].join(",");

async function readAllRows<T>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.code ?? "read_error"} ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function readDatabaseCatalog(client: SupabaseClient): Promise<DatabaseCatalog> {
  const [products, images, categories, subcategories, materials] = await Promise.all([
    readAllRows<DatabaseProduct>(client, "ecommerce_products", PRODUCT_COLUMNS),
    readAllRows<DatabaseProductImage>(client, "ecommerce_product_images", "id,product_id,source_type,path,is_primary,sort_order"),
    readAllRows<TaxonomyRow>(client, "ecommerce_categories", "id,name,slug,is_active"),
    readAllRows<SubcategoryRow>(client, "ecommerce_subcategories", "id,category_id,name,slug,is_active"),
    readAllRows<TaxonomyRow>(client, "ecommerce_materials", "id,name,slug,is_active")
  ]);

  return { products, images, categories, subcategories, materials };
}

export async function readPublicDatabaseCatalog(client: SupabaseClient): Promise<DatabaseCatalog> {
  const products: DatabaseProduct[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("ecommerce_products")
      .select(PRODUCT_COLUMNS)
      .eq("is_active", true)
      .not("legacy_id", "is", null)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`ecommerce_products: ${error.code ?? "read_error"}`);
    const page = (data ?? []) as unknown as DatabaseProduct[];
    products.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const [images, categories, subcategories, materials] = await Promise.all([
    readAllRows<DatabaseProductImage>(client, "ecommerce_product_images", "id,product_id,source_type,path,is_primary,sort_order"),
    readAllRows<TaxonomyRow>(client, "ecommerce_categories", "id,name,slug,is_active"),
    readAllRows<SubcategoryRow>(client, "ecommerce_subcategories", "id,category_id,name,slug,is_active"),
    readAllRows<TaxonomyRow>(client, "ecommerce_materials", "id,name,slug,is_active")
  ]);

  const productIds = new Set(products.map((product) => product.id));
  return { products, images: images.filter((image) => productIds.has(image.product_id)), categories, subcategories, materials };
}
