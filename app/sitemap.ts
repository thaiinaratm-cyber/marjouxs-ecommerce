import type { MetadataRoute } from "next";
import { categories } from "@/data/categories";
import { getPublicProducts } from "@/lib/catalog";
import { categoryFilters, getCategoryFilterHref } from "@/lib/category-navigation";
import { ringMaterialGroups } from "@/lib/ring-filters";
import { absoluteUrl } from "@/lib/seo";

const publicPages = [
  "/",
  "/produtos",
  "/categorias",
  "/sobre",
  "/contato",
  "/servicos",
  "/ajuda",
  "/guia-de-tamanhos",
  "/perguntas-frequentes",
  "/cuidados-com-joias",
  "/garantia-e-trocas",
  "/termo-de-garantia",
  "/politica-de-privacidade",
  "/politica-de-pagamento",
  "/politica-de-entrega",
  "/trocas-e-devolucoes"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categoryPages = categories.flatMap((category) => [
    `/categorias/${category.slug}`,
    ...(categoryFilters[category.slug] ?? []).map((filter) => getCategoryFilterHref(category.slug, filter))
  ]);
  const ringPages = ringMaterialGroups.flatMap((group) => [
    `/aneis/${group.slug}`,
    ...group.subcategories.map((subcategory) => `/aneis/${group.slug}/${subcategory.slug}`)
  ]);
  const productPages = (await getPublicProducts()).map((product) => `/produtos/${product.slug}`);
  const urls = Array.from(new Set([...publicPages, ...categoryPages, ...ringPages, ...productPages]));

  return urls.map((path) => ({ url: absoluteUrl(path) }));
}
