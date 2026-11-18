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

function searchText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

export function readSearchTerm(value?: string | string[]) {
  return typeof value === "string" ? value.slice(0, 120).trim().replace(/\s+/g, " ") : "";
}

export function searchProducts(products: Product[], query: string, limit?: number) {
  const normalizedQuery = searchText(readSearchTerm(query));

  if (!normalizedQuery) return [];

  const tokens = normalizedQuery.split(" ");
  const matches = products.flatMap((product) => {
    const name = searchText(product.name);
    const slug = searchText(product.slug);
    const taxonomy = searchText([product.category, product.subcategory, product.material].join(" "));
    if (!tokens.every((token) => [name, slug, taxonomy].some((text) => text.includes(token)))) return [];

    const rank = name === normalizedQuery ? 0
      : name.startsWith(normalizedQuery) ? 1
      : name.includes(normalizedQuery) ? 2
      : tokens.every((token) => name.includes(token)) || slug.includes(normalizedQuery) ? 3
      : 4;

    return [{ product, rank }];
  }).sort((a, b) => a.rank - b.rank || compareProductNames(a.product, b.product))
    .map(({ product }) => product);
  return typeof limit === "number" ? matches.slice(0, limit) : matches;
}

const productCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });

export function compareProductNames(first: Product, second: Product) {
  return productCollator.compare(first.name, second.name) ||
    (first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
}

export function matchesPriceRange(product: Product, selectedRange: ProductPriceRange) {
  if (!selectedRange) return true;
  if (!hasValidPrice(product) || product.price === null) return false;

  const range = productPriceRanges.find((item) => item.value === selectedRange);
  if (!range) return true;

  if (typeof range.minExclusive === "number" && product.price <= range.minExclusive) return false;
  if (typeof range.max === "number" && product.price > range.max) return false;
  return true;
}

const silverFacet = { value: "prata", label: "Prata" };
const silverMaterialSlugs = new Set([silverFacet.value, "prata-925", "prata-950"]);

export function toPublicMaterialFilterValue(material: string) {
  const slug = toProductFilterValue(material);
  return silverMaterialSlugs.has(slug) ? silverFacet.value : slug;
}

export function getMaterialFilterOptions(products: Product[], requestedMaterial?: string) {
  const materials = products
    .filter((product) => product.category !== "Serviços" && product.stockStatus !== "Serviço")
    .map(({ material }) => toPublicMaterialFilterValue(material) === silverFacet.value ? silverFacet.label : material.trim());

  // Keep a recognized silver filter active even when there are no eligible products.
  if (requestedMaterial === silverFacet.value) materials.push(silverFacet.label);

  return toFilterOptions(materials);
}

export type ProductFilterOption = { label: string; value: string };

export function toFilterOptions(labels: string[]): ProductFilterOption[] {
  const options = new Map<string, string>();
  for (const label of labels) {
    const value = toProductFilterValue(label);
    if (value && !options.has(value)) options.set(value, label);
  }
  return Array.from(options, ([value, label]) => ({ value, label }))
    .sort((first, second) => productCollator.compare(first.label, second.label));
}
