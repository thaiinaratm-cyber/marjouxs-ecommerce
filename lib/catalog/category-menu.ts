import { categories } from "@/data/categories";
import { getCategoryFilterHref } from "@/lib/category-navigation";
import { catalogHref } from "@/lib/catalog/discovery";
import { toProductFilterValue, toPublicMaterialFilterValue, type ProductFilterOption } from "@/lib/product-discovery";

type Selection = { material?: ProductFilterOption; subcategory?: ProductFilterOption };
type MenuEntry = Selection & { label: string; children?: MenuEntry[]; editorialSlug?: string };
export type CategoryMenuLink = { label: string; href: string; children?: CategoryMenuLink[] };
export type CategoryMenuItem = { slug: keyof typeof entries; label: string; href: string; links: CategoryMenuLink[] };

const material = (name: string, label = name): MenuEntry =>
  ({ label, material: { label: name, value: toPublicMaterialFilterValue(name) } });
const subcategory = (name: string, label = name): MenuEntry =>
  ({ label, subcategory: { label: name, value: toProductFilterValue(name) } });
const materials = [material("Ouro 18k"), material("Prata")];

function gender(label: string, name: string, extra: MenuEntry[] = []): MenuEntry {
  const group = subcategory(name, label);
  return {
    ...group,
    children: [...materials.map((entry) => ({ ...entry, subcategory: group.subcategory })), ...extra]
  };
}

// Use registered subcategories, including those without any public products.
const entries = {
  aliancas: [
    material("Ouro 18k", "Ouro 18k/750"), materials[1],
    subcategory("Alianças Banhado a Ouro", "Banhado a Ouro"),
    { label: "Moeda", editorialSlug: "moeda" }
  ],
  aneis: [gender("Masculino", "Masculino"), gender("Feminino", "Feminino", [subcategory("Pérola")]), subcategory("Formatura")],
  brincos: [...materials, subcategory("Brincos infantis", "Infantil")],
  correntes: [gender("Masculino", "Correntes masculinas"), gender("Feminino", "Correntes femininas")],
  pulseiras: [
    gender("Masculino", "Pulseiras Masculinas"), gender("Feminino", "Pulseiras Femininas"),
    subcategory("Pulseiras infantis", "Infantil")
  ],
  braceletes: materials,
  pingentes: [gender("Masculino", "Pingentes Masculinos"), gender("Feminino", "Pingentes Femininos")],
  relogios: [subcategory("Relógios masculinos", "Masculinos"), subcategory("Relógios femininos", "Femininos")]
} satisfies Record<string, MenuEntry[]>;

function toMenuLink(slug: string, entry: MenuEntry): CategoryMenuLink {
  const href = entry.editorialSlug
    ? getCategoryFilterHref(slug, { label: entry.label, slug: entry.editorialSlug })
    : catalogHref(`/categorias/${slug}`, { subcategoria: entry.subcategory?.value, material: entry.material?.value });
  return { label: entry.label, href, children: entry.children?.map((child) => toMenuLink(slug, child)) };
}

export const categoryMenu: CategoryMenuItem[] = (Object.keys(entries) as CategoryMenuItem["slug"][]).map((slug) => ({
  slug,
  label: categories.find((category) => category.slug === slug)!.name,
  href: `/categorias/${slug}`,
  links: entries[slug].map((entry) => toMenuLink(slug, entry))
}));

export function getCategoryMenuFacets(slug: string) {
  const entriesForCategory: MenuEntry[] = Object.hasOwn(entries, slug) ? entries[slug as keyof typeof entries] : [];
  const destinations = entriesForCategory.flatMap((entry) => [entry, ...(entry.children ?? [])]);
  const options = (field: keyof Selection) =>
    Array.from(new Map(destinations.flatMap((entry) => {
      const option = entry[field];
      return option ? [[option.value, option] as const] : [];
    })).values());
  return { subcategories: options("subcategory"), materials: options("material") };
}
