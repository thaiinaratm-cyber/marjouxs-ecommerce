import { getProductsByCategory } from "@/lib/products";
import { normalizeText } from "@/lib/format";
import type { Product } from "@/types/product";

export type RingMaterialSlug = "ouro-18k" | "prata-950";
export type RingSubcategorySlug = "masculino" | "feminino" | "perola" | "formatura";

export const ringMaterialGroups: {
  label: string;
  slug: RingMaterialSlug;
  subcategories: { label: string; slug: RingSubcategorySlug }[];
}[] = [
  {
    label: "Ouro 18k",
    slug: "ouro-18k",
    subcategories: [
      { label: "Masculino", slug: "masculino" },
      { label: "Feminino", slug: "feminino" },
      { label: "Pérola", slug: "perola" },
      { label: "Formatura", slug: "formatura" }
    ]
  },
  {
    label: "Prata 950",
    slug: "prata-950",
    subcategories: [
      { label: "Masculino", slug: "masculino" },
      { label: "Feminino", slug: "feminino" }
    ]
  }
];

function productSearchText(product: Product) {
  return normalizeText([product.name, product.material, product.subcategory, product.description, product.images.join(" ")].join(" "));
}

export function getRingMaterialGroup(slug: string) {
  return ringMaterialGroups.find((group) => group.slug === slug);
}

export function getRingSubcategory(groupSlug: RingMaterialSlug, subcategorySlug?: string) {
  const group = getRingMaterialGroup(groupSlug);
  return group?.subcategories.find((subcategory) => subcategory.slug === subcategorySlug);
}

export function isRingMaterialSlug(value: string): value is RingMaterialSlug {
  return value === "ouro-18k" || value === "prata-950";
}

export function getRingProductSubcategorySlug(product: Product): RingSubcategorySlug {
  const text = productSearchText(product);

  if (text.includes("formatura")) {
    return "formatura";
  }

  if (text.includes("perola")) {
    return "perola";
  }

  if (text.includes("masculino")) {
    return "masculino";
  }

  return "feminino";
}

export function matchesRingMaterial(product: Product, materialSlug: RingMaterialSlug) {
  const material = normalizeText(product.material);
  const text = productSearchText(product);

  if (materialSlug === "ouro-18k") {
    return material === "ouro 18k" || text.includes("ouro 18k") || text.includes("ouro-18k") || text.includes("18k");
  }

  return material === "prata 950" || text.includes("prata 950") || text.includes("prata-950");
}

export function getRingProducts(materialSlug: RingMaterialSlug, subcategorySlug?: RingSubcategorySlug) {
  return getProductsByCategory("Anéis")
    .filter((product) => matchesRingMaterial(product, materialSlug))
    .filter((product) => (subcategorySlug ? getRingProductSubcategorySlug(product) === subcategorySlug : true));
}
