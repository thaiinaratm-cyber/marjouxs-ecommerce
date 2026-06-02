import { hasValidPrice } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

export type ProductSortOrder = "relevantes" | "menor-preco" | "maior-preco";

export function normalizeSortOrder(value?: string): ProductSortOrder {
  if (value === "menor-preco" || value === "maior-preco") {
    return value;
  }

  return "relevantes";
}

export function sortProducts(products: Product[], order: ProductSortOrder) {
  if (order === "relevantes") {
    return products;
  }

  return [...products].sort((first, second) => {
    const firstHasPrice = hasValidPrice(first);
    const secondHasPrice = hasValidPrice(second);

    if (!firstHasPrice && !secondHasPrice) return 0;
    if (!firstHasPrice) return 1;
    if (!secondHasPrice) return -1;

    const firstPrice = first.price ?? 0;
    const secondPrice = second.price ?? 0;

    return order === "menor-preco" ? firstPrice - secondPrice : secondPrice - firstPrice;
  });
}
