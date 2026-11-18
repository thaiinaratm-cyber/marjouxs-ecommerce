import { getProductsByCategory } from "@/lib/products";
import { matchesEditorialVariant } from "@/lib/catalog/discovery";
import { toProductFilterValue } from "@/lib/product-discovery";
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

export function getRingProductSubcategorySlug(product: Product): RingSubcategorySlug | undefined {
  const slug = toProductFilterValue(product.subcategory);
  return ringMaterialGroups[0].subcategories.find((item) => item.slug === slug)?.slug;
}

export function matchesRingMaterial(product: Product, materialSlug: RingMaterialSlug) {
  return matchesEditorialVariant(product, materialSlug);
}

export function getRingProducts(materialSlug: RingMaterialSlug, subcategorySlug?: RingSubcategorySlug) {
  return getProductsByCategory("Anéis")
    .filter((product) => matchesRingMaterial(product, materialSlug))
    .filter((product) => (subcategorySlug ? getRingProductSubcategorySlug(product) === subcategorySlug : true));
}
