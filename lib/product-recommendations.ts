import { normalizeText } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

export const MAX_MANUAL_RELATIONS = 8;
export const MAX_FALLBACK_CANDIDATES = 16;
export type RelatedProductsResult = { mode: "manual" | "automatic"; products: Product[] };
export type RecommendationRow = { mode: RelatedProductsResult["mode"]; related_slug: string | null };

function facts(product: Product) {
  const text = normalizeText([product.name, product.subcategory, product.technicalDetails?.genderStyle, ...(product.tags ?? [])].join(" "));
  return {
    child: /\b(infantil|infantis|crianca|criancas|bebe|bebes)\b/.test(text),
    complement: /\b(solitario|solitarios|aparador|aparadores)\b/.test(text),
    material: normalizeText(product.material),
    subcategory: normalizeText(product.subcategory)
  };
}

function eligible(current: Product, product: Product) {
  return product.id !== current.id && product.slug !== current.slug &&
    (product.stockStatus === "Dispon\u00edvel" || product.stockStatus === "Sob encomenda");
}

function priceDistance(current: Product, candidate: Product) {
  if (!hasValidPrice(current)) return 0;
  if (!hasValidPrice(candidate)) return Infinity;
  return Math.abs(Math.log(candidate.price! / current.price!));
}

export function selectRelatedProducts(current: Product, candidates: Product[], limit = 4) {
  if (limit <= 0) return [];
  const base = facts(current);
  const seen = new Set<string>();
  return candidates.flatMap(product => {
    if (!eligible(current, product) || seen.has(product.id)) return [];
    seen.add(product.id);
    const match = facts(product);
    const sameCategory = current.category === product.category;
    const compatible = (current.category === "Alian\u00e7as" && product.category === "An\u00e9is" && match.complement) ||
      (current.category === "Correntes" && product.category === "Pingentes") ||
      (current.category === "Pingentes" && product.category === "Correntes");
    if (match.child !== base.child || (!sameCategory && !compatible)) return [];
    return [{ product, sameCategory, sameMaterial: Boolean(base.material && base.material === match.material),
      sameSubcategory: Boolean(base.subcategory && base.subcategory === match.subcategory),
      sameStyle: current.category !== "Alian\u00e7as" || match.complement === base.complement,
      distance: priceDistance(current, product) }];
  }).sort((a, b) =>
    Number(b.sameCategory) - Number(a.sameCategory) ||
    Number(b.sameMaterial) - Number(a.sameMaterial) ||
    Number(b.sameSubcategory) - Number(a.sameSubcategory) ||
    Number(b.sameStyle) - Number(a.sameStyle) ||
    a.distance - b.distance ||
    Number(b.product.featured) - Number(a.product.featured) ||
    a.product.name.localeCompare(b.product.name, "pt-BR") ||
    a.product.id.localeCompare(b.product.id)
  ).slice(0, limit).map(candidate => candidate.product);
}

export function resolveDatabaseRecommendations(current: Product, catalog: Product[], rows: RecommendationRow[], limit = 4): RelatedProductsResult {
  const mode = rows.some(row => row.mode === "manual") ? "manual" : "automatic";
  const bySlug = new Map(catalog.map(product => [product.slug, product]));
  const seen = new Set<string>();
  const products = rows.flatMap(row => {
    const product = row.related_slug ? bySlug.get(row.related_slug) : undefined;
    if (row.mode !== mode || !product || seen.has(product.id) || !eligible(current, product)) return [];
    seen.add(product.id);
    return [product];
  });
  return { mode, products: products.slice(0, mode === "manual" ? MAX_MANUAL_RELATIONS : limit) };
}
