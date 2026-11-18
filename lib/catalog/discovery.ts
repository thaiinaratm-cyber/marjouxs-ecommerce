import type { CategoryFilter } from "@/lib/category-navigation";
import { formatCurrency } from "@/lib/format";
import {
  getMaterialFilterOptions, matchesPriceRange, normalizePriceRange, productPriceRanges, readSearchTerm,
  searchProducts, toFilterOptions, toProductFilterValue, toPublicMaterialFilterValue, type ProductFilterOption
} from "@/lib/product-discovery";
import { hasValidPrice } from "@/lib/product-pricing";
import { normalizeSortOrder, sortProducts } from "@/lib/product-sorting";
import type { Product } from "@/types/product";

const pageSize = 24;
const keys = ["busca", "categoria", "subcategoria", "material", "preco", "min_price", "max_price",
  "tipo_preco", "disponibilidade", "pedra", "ordem", "pagina"] as const;
export type CatalogParams = Record<string, string | string[] | undefined>;
export type DiscoveryQuery = Partial<Record<(typeof keys)[number], string>>;

export const priceKinds = [
  { value: "com-preco", label: "Com preço" },
  { value: "sob-orcamento", label: "Sob orçamento" }
];

export type DiscoveryOptions = {
  categories: ProductFilterOption[];
  subcategories: Record<string, ProductFilterOption[]>;
  materials: ProductFilterOption[];
  availability: ProductFilterOption[];
  hasCustomizableStone: boolean;
};

function read(params: CatalogParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export function hasDiscoveryParams(params: CatalogParams = {}, editorialSlug?: string) {
  return [...keys, "sort"].some((key) => Boolean(params[key]) &&
    !(key === "subcategoria" && editorialSlug && params[key] === editorialSlug));
}

export function catalogHref(path: string, query: DiscoveryQuery) {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = query[key];
    if (value && !(key === "ordem" && value === "relevantes") && !(key === "pagina" && value === "1")) {
      params.set(key, value);
    }
  }
  return params.size ? `${path}?${params}` : path;
}

function readFacet(value: string | undefined, options: ProductFilterOption[]) {
  const slug = value && value.length <= 100 ? toProductFilterValue(value) : "";
  return options.some((option) => option.value === slug) ? slug : undefined;
}

function withSelectedMenuFacet(
  options: ProductFilterOption[], requested: string | undefined, menuOptions: ProductFilterOption[] = []
) {
  if (!requested || readFacet(requested, options)) return options;
  const selected = readFacet(requested, menuOptions);
  const option = menuOptions.find(({ value }) => value === selected);
  return option ? [...options, option] : options;
}

function priceBound(value?: string) {
  if (!value || !/^\d{1,9}(?:[.,]\d{1,2})?$/.test(value)) return undefined;
  return String(Number(value.replace(",", ".")));
}

const editorialMaterials = new Map([
  ["ouro-18k", ["ouro-18k", "ouro-18k-750", "ouro-750"]],
  ["ouro-18k-750", ["ouro-18k", "ouro-18k-750", "ouro-750"]],
  ["prata-950", ["prata-950"]],
  ["prata-925", ["prata-925"]],
  ["moeda", ["moeda", "ouro-moeda"]],
  ["banhado-a-ouro", ["banhado-a-ouro", "banhado", "folheado-a-ouro"]]
]);

export function matchesEditorialVariant(product: Product, slug: string) {
  const materials = editorialMaterials.get(slug);
  if (materials) return materials.includes(toProductFilterValue(product.material));
  const terms = toProductFilterValue(product.subcategory).split("-");
  return terms.includes(slug) || (slug === "infantil" && terms.includes("infantis"));
}

function getAvailability(product: Product) {
  return product.catalogAvailability ?? product.stockStatus;
}

export function discoverCatalog(
  products: Product[],
  params: CatalogParams = {},
  { scoped = false, lockSubcategory = false, editorial = [], menuFacets }: {
    scoped?: boolean; lockSubcategory?: boolean; editorial?: CategoryFilter[];
    menuFacets?: { subcategories: ProductFilterOption[]; materials: ProductFilterOption[] };
  } = {}
) {
  const categories = scoped ? [] : toFilterOptions(products.map((product) => product.category));
  const category = readFacet(read(params, "categoria"), categories);
  const byCategory = new Map<string, string[]>();
  const subcategoryLabels: string[] = [];
  for (const product of products) {
    if (!product.subcategory) continue;
    subcategoryLabels.push(product.subcategory);
    const slug = toProductFilterValue(product.category);
    const labels = byCategory.get(slug) ?? [];
    labels.push(product.subcategory);
    byCategory.set(slug, labels);
  }
  const allSubcategories = lockSubcategory ? [] : toFilterOptions(subcategoryLabels);
  const editorialSlug = read(params, "subcategoria");
  const existingVariant = editorial.find((filter) => filter.slug === editorialSlug);
  const aliasProduct = !existingVariant && !lockSubcategory && scoped && editorialSlug && editorialMaterials.has(editorialSlug)
    ? products.find((product) => matchesEditorialVariant(product, editorialSlug))
    : undefined;
  const alias = existingVariant ?? (editorialSlug && aliasProduct ? { slug: editorialSlug, label: aliasProduct.material } : undefined);
  const rootSubcategories = alias
    ? [{ value: alias.slug, label: alias.label }, ...allSubcategories.filter((option) => option.value !== alias.slug)]
    : withSelectedMenuFacet(allSubcategories, editorialSlug, menuFacets?.subcategories);
  const materialParam = read(params, "material");
  const requestedMaterial = materialParam && materialParam.length <= 100
    ? toPublicMaterialFilterValue(materialParam) : undefined;
  const options: DiscoveryOptions = {
    categories,
    subcategories: {
      "": rootSubcategories,
      ...(!scoped ? Object.fromEntries(Array.from(byCategory, ([slug, labels]) => [slug, toFilterOptions(labels)])) : {})
    },
    materials: withSelectedMenuFacet(getMaterialFilterOptions(products, requestedMaterial), requestedMaterial, menuFacets?.materials),
    availability: toFilterOptions(products.map(getAvailability)),
    hasCustomizableStone: products.some((product) => Boolean(product.stoneCustomization))
  };
  const subcategory = readFacet(editorialSlug, options.subcategories[category ?? ""] ?? []);
  const material = readFacet(requestedMaterial, options.materials);
  const availability = readFacet(read(params, "disponibilidade"), options.availability);
  const queryTerm = readSearchTerm(read(params, "busca"));
  const priceRange = normalizePriceRange(read(params, "preco"));
  const priceKind = readFacet(read(params, "tipo_preco"), priceKinds);
  const min = priceBound(read(params, "min_price"));
  const max = priceBound(read(params, "max_price"));
  const validBounds = min === undefined || max === undefined || Number(min) <= Number(max);
  const minPrice = validBounds ? min : undefined;
  const maxPrice = validBounds ? max : undefined;
  const lower = minPrice === undefined ? -Infinity : Number(minPrice);
  const upper = maxPrice === undefined ? Infinity : Number(maxPrice);
  const orderAlias = read(params, "sort");
  const order = normalizeSortOrder(read(params, "ordem") ?? (
    orderAlias === "price_asc" ? "menor-preco" : orderAlias === "price_desc" ? "maior-preco" :
      orderAlias === "name_asc" ? "nome-az" : orderAlias
  ));
  const stone = read(params, "pedra") === "1";
  const facetMatches = products.filter((product) => {
    if (category && toProductFilterValue(product.category) !== category) return false;
    if (subcategory && (alias?.slug === subcategory ? !matchesEditorialVariant(product, subcategory)
      : toProductFilterValue(product.subcategory) !== subcategory)) return false;
    if (material && toPublicMaterialFilterValue(product.material) !== material) return false;
    if (availability && toProductFilterValue(getAvailability(product)) !== availability) return false;
    if (stone && !product.stoneCustomization) return false;
    const priced = hasValidPrice(product);
    if (priceKind === "com-preco" && !priced) return false;
    if (priceKind === "sob-orcamento" && (priced || !product.allowWhatsappQuote)) return false;
    if (!matchesPriceRange(product, priceRange)) return false;
    if ((minPrice !== undefined || maxPrice !== undefined) &&
        (!priced || product.price === null || product.price < lower || product.price > upper)) return false;
    return true;
  });
  const matches = sortProducts(queryTerm ? searchProducts(facetMatches, queryTerm) : facetMatches, order);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = read(params, "pagina") ?? "";
  const currentPage = /^[1-9]\d{0,8}$/.test(page) ? Math.min(Number(page), pageCount) : 1;
  const query: DiscoveryQuery = {
    busca: queryTerm || undefined, categoria: category, subcategoria: subcategory, material,
    preco: priceRange || undefined, min_price: minPrice, max_price: maxPrice, tipo_preco: priceKind,
    disponibilidade: availability, pedra: stone ? "1" : undefined, ordem: order,
    pagina: currentPage > 1 ? String(currentPage) : undefined
  };
  const label = (choices: ProductFilterOption[], value?: string) =>
    choices.find((choice) => choice.value === value)?.label;
  const chips = [
    { label: queryTerm ? `Busca: ${queryTerm}` : undefined, remove: { busca: undefined } },
    { label: label(categories, category), remove: { categoria: undefined, subcategoria: undefined } },
    { label: label(options.subcategories[category ?? ""] ?? [], subcategory), remove: { subcategoria: undefined } },
    { label: label(options.materials, material), remove: { material: undefined } },
    { label: label(productPriceRanges, priceRange), remove: { preco: undefined } },
    { label: minPrice !== undefined ? `A partir de ${formatCurrency(Number(minPrice))}` : undefined, remove: { min_price: undefined } },
    { label: maxPrice !== undefined ? `Até ${formatCurrency(Number(maxPrice))}` : undefined, remove: { max_price: undefined } },
    { label: label(priceKinds, priceKind), remove: { tipo_preco: undefined } },
    { label: label(options.availability, availability), remove: { disponibilidade: undefined } },
    { label: stone ? "Pedra personalizável" : undefined, remove: { pedra: undefined } }
  ].flatMap(({ label, remove }) => label ? [{ label, remove }] : []);
  return {
    query, options, chips, currentPage, pageCount, total: matches.length,
    products: matches.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  };
}
