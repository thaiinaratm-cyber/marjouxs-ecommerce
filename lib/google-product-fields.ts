import { createHash } from "node:crypto";
import type { Product } from "@/types/product";

export const GOOGLE_PRODUCT_BRAND = "Marjouxs Joias";

// Hash only unsupported IDs; never use mutable fields such as title or price.
export function getGoogleProductId(id: string) {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(id)
    ? id
    : `mj-${createHash("sha256").update(id).digest("hex").slice(0, 44)}`;
}

export function getGoogleProductAvailability(product: Product) {
  if (product.stockStatus === "Indisponível") return "out_of_stock";
  // Existing items can be ordered within the published handling time.
  // Made-to-order does not imply an unreleased or backordered product.
  if (product.stockStatus === "Disponível" || product.stockStatus === "Sob encomenda") return "in_stock";
  return undefined;
}
