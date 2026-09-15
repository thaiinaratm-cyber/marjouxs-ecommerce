import { normalizeText } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

export type ProductPriceRange =
  | ""
  | "ate-300"
  | "300-500"
  | "500-1000"
  | "1000-2000"
  | "acima-2000";

export const productPriceRanges: Array<{
  label: string;
  value: Exclude<ProductPriceRange, "">;
  minExclusive?: number;
  max?: number;
}> = [
  { label: "Até R$ 300", value: "ate-300", max: 300 },
  { label: "R$ 300 a R$ 500", value: "300-500", minExclusive: 300, max: 500 },
  { label: "R$ 500 a R$ 1.000", value: "500-1000", minExclusive: 500, max: 1000 },
  { label: "R$ 1.000 a R$ 2.000", value: "1000-2000", minExclusive: 1000, max: 2000 },
  { label: "Acima de R$ 2.000", value: "acima-2000", minExclusive: 2000 }
];

export function toProductFilterValue(value: string) {
  return normalizeText(value)
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePriceRange(value?: string): ProductPriceRange {
  return productPriceRanges.some((range) => range.value === value) ? (value as ProductPriceRange) : "";
}

export function getProductSearchText(product: Product) {
  return normalizeText(
    [
      product.name,
      product.description,
      product.category,
      product.subcategory,
      product.material,
      product.slug,
      ...(product.tags ?? [])
    ].join(" ")
  );
}

export function searchProducts(products: Product[], query: string, limit?: number) {
  const normalizedQuery = normalizeText(query).trim();

  if (!normalizedQuery) return [];

  const matches = products.filter((product) => getProductSearchText(product).includes(normalizedQuery));
  return typeof limit === "number" ? matches.slice(0, limit) : matches;
}

function matchesPriceRange(product: Product, selectedRange: ProductPriceRange) {
  if (!selectedRange) return true;
  if (!hasValidPrice(product) || product.price === null) return false;

  const range = productPriceRanges.find((item) => item.value === selectedRange);
  if (!range) return true;

  if (typeof range.minExclusive === "number" && product.price <= range.minExclusive) return false;
  if (typeof range.max === "number" && product.price > range.max) return false;
  return true;
}

export function filterCatalogProducts({
  products,
  query = "",
  category = "",
  material = "",
  priceRange = ""
}: {
  products: Product[];
  query?: string;
  category?: string;
  material?: string;
  priceRange?: ProductPriceRange;
}) {
  const normalizedQuery = normalizeText(query).trim();

  return products.filter((product) => {
    const matchesQuery = normalizedQuery
      ? getProductSearchText(product).includes(normalizedQuery)
      : true;
    const matchesCategory = category
      ? toProductFilterValue(product.category) === category
      : true;
    const matchesMaterial = material
      ? toProductFilterValue(product.material) === material
      : true;

    return matchesQuery && matchesCategory && matchesMaterial && matchesPriceRange(product, priceRange);
  });
}

export function getMaterialFilterOptions(products: Product[]) {
  const materials = products
    .filter((product) => product.category !== "Serviços" && product.stockStatus !== "Serviço")
    .map((product) => product.material.trim())
    .filter(Boolean);

  return Array.from(new Set(materials))
    .sort((first, second) => first.localeCompare(second, "pt-BR"))
    .map((label) => ({ label, value: toProductFilterValue(label) }));
}
