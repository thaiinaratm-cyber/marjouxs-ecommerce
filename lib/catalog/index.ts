import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache, unstable_noStore } from "next/cache";
import { cache } from "react";
import { products } from "@/data/products";
import { getCatalogSource, isCatalogFallbackEnabled } from "@/lib/catalog/config";
import { readPublicDatabaseCatalog } from "@/lib/catalog/database-products";
import { normalizePublicDatabaseCatalog } from "@/lib/catalog/normalize-public";
import { resolvePublicCatalog } from "@/lib/catalog/resolve";
import { searchProducts } from "@/lib/product-discovery";
import { selectRelatedProducts } from "@/lib/product-recommendations";
import { getRingProductSubcategorySlug, matchesRingMaterial, type RingMaterialSlug, type RingSubcategorySlug } from "@/lib/ring-filters";
import { getVisibleProducts } from "@/lib/products";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { CategoryName, Product } from "@/types/product";

const readCachedDatabaseProducts = unstable_cache(async (): Promise<Product[]> => {
  const { url, anonKey } = getSupabasePublicConfig();
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) })
    }
  });
  const catalog = await readPublicDatabaseCatalog(client);
  return normalizePublicDatabaseCatalog(catalog, products);
}, ["marjouxs-public-catalog-v1"], { revalidate: 300 });

const getPublicCatalog = cache(async (): Promise<Product[]> => {
  unstable_noStore();
  return resolvePublicCatalog({
    source: getCatalogSource(),
    fallback: isCatalogFallbackEnabled(),
    staticProducts: products,
    readDatabase: readCachedDatabaseProducts
  });
});

export const getPublicProducts = cache(async (): Promise<Product[]> =>
  getVisibleProducts(await getPublicCatalog())
);

export async function getPublicProductBySlug(slug: string) {
  return (await getPublicCatalog()).find((product) => product.slug === slug);
}

export async function getPublicProductsByCategory(category: CategoryName) {
  return (await getPublicProducts()).filter((product) => product.category === category);
}

export async function getPublicProductsBySubcategory(category: CategoryName, subcategory: string) {
  return (await getPublicProducts()).filter((product) => product.category === category && product.subcategory === subcategory);
}

export async function searchPublicProducts(query: string, limit?: number) {
  return searchProducts(await getPublicProducts(), query, limit);
}

export async function getPublicRelatedProducts(product: Product, limit = 4) {
  return selectRelatedProducts(product, await getPublicProducts(), limit);
}

export async function getPublicRingProducts(material: RingMaterialSlug, subcategory?: RingSubcategorySlug) {
  return (await getPublicProductsByCategory("Anéis"))
    .filter((product) => matchesRingMaterial(product, material))
    .filter((product) => !subcategory || getRingProductSubcategorySlug(product) === subcategory);
}
