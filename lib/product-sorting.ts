import { hasValidPrice } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

export type ProductSortOrder = "relevantes" | "destaques" | "menor-preco" | "maior-preco" | "nome-az";

export function normalizeSortOrder(value?: string): ProductSortOrder {
  if (
    value === "destaques" ||
    value === "menor-preco" ||
    value === "maior-preco" ||
    value === "nome-az"
  ) {
    return value;
  }

  return "relevantes";
}

export function sortProducts(products: Product[], order: ProductSortOrder) {
  if (order === "relevantes") {
    return products;
  }

  if (order === "destaques") {
    return [...products].sort((first, second) => Number(second.featured) - Number(first.featured));
  }

  if (order === "nome-az") {
    return [...products].sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
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
