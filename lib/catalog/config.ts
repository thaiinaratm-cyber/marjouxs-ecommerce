export type CatalogSource = "static" | "database";

type CatalogEnv = Record<string, string | undefined>;

export function getCatalogSource(env: CatalogEnv = process.env): CatalogSource {
  return env.PRODUCT_CATALOG_SOURCE === "database" ? "database" : "static";
}

export function isCatalogFallbackEnabled(env: CatalogEnv = process.env): boolean {
  return env.PRODUCT_CATALOG_FALLBACK !== "false";
}
