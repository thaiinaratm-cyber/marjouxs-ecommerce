import type { Product } from "@/types/product";

export function hasValidPrice(product: Product) {
  return typeof product.price === "number" && product.price > 0 && product.priceLabel.trim().toLowerCase() !== "sob orçamento";
}
