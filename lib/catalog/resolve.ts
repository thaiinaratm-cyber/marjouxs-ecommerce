import type { CatalogSource } from "@/lib/catalog/config";
import type { Product } from "@/types/product";

export class CatalogUnavailableError extends Error {
  constructor() {
    super("public_catalog_unavailable");
    this.name = "CatalogUnavailableError";
  }
}

export class CatalogDataError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "CatalogDataError";
  }
}

export async function resolvePublicCatalog({
  source,
  staticProducts,
  readDatabase,
  log = console.info
}: {
  source: CatalogSource;
  fallback: boolean;
  staticProducts: Product[];
  readDatabase: () => Promise<Product[]>;
  log?: (event: string, details: Record<string, string | boolean>) => void;
}): Promise<Product[]> {
  if (source === "static") {
    log("public_catalog", { catalog_source: "static", catalog_fallback_used: false });
    return staticProducts;
  }

  try {
    const databaseProducts = await readDatabase();
    if (!Array.isArray(databaseProducts) || databaseProducts.length === 0) {
      throw new CatalogDataError("invalid_catalog_shape");
    }
    log("public_catalog", { catalog_source: "database", catalog_fallback_used: false });
    return databaseProducts;
  } catch (error) {
    if (error instanceof CatalogDataError) throw new CatalogUnavailableError();
    // A static snapshot cannot distinguish a newly deactivated product during an outage.
    log("public_catalog", { catalog_source: "database", catalog_fallback_used: false });
    throw new CatalogUnavailableError();
  }
}
