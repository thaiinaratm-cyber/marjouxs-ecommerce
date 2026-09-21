import { normalizeText } from "@/lib/format";
import type { Product } from "@/types/product";

export type CategoryFilter = {
  label: string;
  slug: string;
  href?: string;
};

export const categoryFilters: Record<string, CategoryFilter[]> = {
  aliancas: [
    { label: "Ouro 18k/750", slug: "ouro-18k-750" },
    { label: "Prata 950", slug: "prata-950" },
    { label: "Banhado a Ouro", slug: "banhado-a-ouro" },
    { label: "Moeda", slug: "moeda" }
  ],
  aneis: [
    { label: "Ouro 18k", slug: "ouro-18k", href: "/aneis/ouro-18k" },
    { label: "Prata 950", slug: "prata-950", href: "/aneis/prata-950" }
  ],
  brincos: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" },
    { label: "Infantil", slug: "infantil" }
  ],
  correntes: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 925", slug: "prata-925" }
  ],
  pulseiras: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 925", slug: "prata-925" },
    { label: "Infantil", slug: "infantil" }
  ],
  braceletes: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" }
  ],
  pingentes: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" }
  ]
};

export function getCategoryFilterHref(categorySlug: string, filter: CategoryFilter) {
  return filter.href ?? `/categorias/${categorySlug}?subcategoria=${encodeURIComponent(filter.slug)}`;
}

export function getProductCategoryFilter(categorySlug: string, product: Product) {
  const options = categoryFilters[categorySlug] ?? [];
  const material = normalizeText(product.material);
  const subcategory = normalizeText(product.subcategory);
  const searchable = normalizeText(`${product.name} ${product.material} ${product.subcategory}`);

  const contextualMatch = options.find((option) => {
    if (option.slug === "infantil") return subcategory.includes("infantil") || searchable.includes("infantil");
    if (option.slug === "banhado-a-ouro") return searchable.includes("banhado") || searchable.includes("folheado");
    if (option.slug === "moeda") return searchable.includes("moeda");
    return false;
  });

  if (contextualMatch) return contextualMatch;

  if (material.includes("ouro 18k") || material.includes("ouro 750")) {
    return options.find((option) => option.slug === "ouro-18k" || option.slug === "ouro-18k-750");
  }

  if (material.includes("prata 950")) {
    return options.find((option) => option.slug === "prata-950");
  }

  if (material.includes("prata 925")) {
    return options.find((option) => option.slug === "prata-925");
  }

  return options.find((option) => searchable.includes(normalizeText(option.label)));
}
