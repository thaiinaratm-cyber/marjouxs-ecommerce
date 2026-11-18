import { hasValidPrice } from "@/lib/product-pricing";
import { compareProductNames } from "@/lib/product-discovery";
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
    return [...products].sort((first, second) => Number(second.featured) - Number(first.featured) || compareProductNames(first, second));
  }

  if (order === "nome-az") {
    return [...products].sort(compareProductNames);
  }

  return [...products].sort((first, second) => {
    const firstHasPrice = hasValidPrice(first);
    const secondHasPrice = hasValidPrice(second);

    if (!firstHasPrice && !secondHasPrice) return compareProductNames(first, second);
    if (!firstHasPrice) return 1;
    if (!secondHasPrice) return -1;

    const firstPrice = first.price ?? 0;
    const secondPrice = second.price ?? 0;

    return (order === "menor-preco" ? firstPrice - secondPrice : secondPrice - firstPrice) ||
      compareProductNames(first, second);
  });
}
