import { describe, expect, it } from "vitest";
import { categoryMenu, getCategoryMenuFacets, type CategoryMenuItem } from "@/lib/catalog/category-menu";
import { categoryFilters } from "@/lib/category-navigation";
import { discoverCatalog } from "@/lib/catalog/discovery";
import type { Product } from "@/types/product";

const bySlug = (slug: CategoryMenuItem["slug"]) => categoryMenu.find((category) => category.slug === slug)!;

function item(id: string, category: Product["category"], subcategory: string, material: string): Product {
  return {
    id, name: id, slug: id, category, subcategory, material, price: 180, priceLabel: "R$ 180,00",
    installments: "", description: "", images: ["/produtos/qa.png"], featured: false,
    stockStatus: "Disponível", isCustomOrder: false, allowWhatsappQuote: true
  };
}

function resolve(slug: CategoryMenuItem["slug"], href: string, products: Product[]) {
  const category = bySlug(slug);
  const url = new URL(href, "https://shop.example");
  expect(url.pathname).toBe(category.href);
  return discoverCatalog(products.filter((product) => product.category === category.label),
    Object.fromEntries(url.searchParams), {
      scoped: true, editorial: categoryFilters[slug], menuFacets: getCategoryMenuFacets(slug)
    });
}

describe("navegação pública do catálogo", () => {
  it("mantém as oito categorias e não gera links públicos com teor de prata", () => {
    expect(categoryMenu.map(({ label }) => label)).toEqual([
      "Alianças", "Anéis", "Brincos", "Correntes", "Pulseiras", "Braceletes", "Pingentes", "Relógios"
    ]);
    for (const { href, links } of categoryMenu) {
      const destinations = links.flatMap((item) => [item, ...(item.children ?? [])]);
      expect(new Set(destinations.map((item) => item.href)).size).toBe(destinations.length);
      for (const item of destinations) {
        const url = new URL(item.href, "https://shop.example");
        expect(url.pathname).toBe(href);
        expect(item.label).not.toMatch(/Prata (925|950)/);
        if (item.label === "Prata") expect(url.searchParams.get("material")).toBe("prata");
      }
    }
  });

  it("usa os materiais de Alianças e preserva a entrada editorial Moeda", () => {
    const options = bySlug("aliancas").links;
    expect(options.map(({ label, href }) => [label, href])).toEqual([
      ["Ouro 18k/750", "/categorias/aliancas?material=ouro-18k"],
      ["Prata", "/categorias/aliancas?material=prata"],
      ["Banhado a Ouro", "/categorias/aliancas?subcategoria=aliancas-banhado-a-ouro"],
      ["Moeda", "/categorias/aliancas?subcategoria=moeda"]
    ]);
    const plated = item("banhada", "Alianças", "Alianças Banhado a Ouro", "Semijoia");
    const other = item("outro", "Alianças", "Alianças de Namoro", "Semijoia");
    expect(resolve("aliancas", options[2].href, [plated, other]).products).toEqual([plated]);
    expect(resolve("aliancas", options[3].href, [plated, other]).total).toBe(0);
  });

  it("agrupa Anéis por gênero, reutiliza Pérola e deixa Formatura independente de material", () => {
    const [men, women, graduation] = bySlug("aneis").links;
    expect(men).toMatchObject({ label: "Masculino", children: [
      { label: "Ouro 18k", href: "/categorias/aneis?subcategoria=masculino&material=ouro-18k" },
      { label: "Prata", href: "/categorias/aneis?subcategoria=masculino&material=prata" }
    ] });
    expect(women).toMatchObject({ label: "Feminino", children: [
      { label: "Ouro 18k", href: "/categorias/aneis?subcategoria=feminino&material=ouro-18k" },
      { label: "Prata", href: "/categorias/aneis?subcategoria=feminino&material=prata" },
      { label: "Pérola", href: "/categorias/aneis?subcategoria=perola" }
    ] });
    expect(graduation).toMatchObject({ label: "Formatura", href: "/categorias/aneis?subcategoria=formatura" });
    const rings = [
      item("m", "Anéis", "Masculino", "Prata 950"), item("f", "Anéis", "Feminino", "Prata 925"),
      item("perola", "Anéis", "Pérola", "Ouro 18k"), item("formatura", "Anéis", "Formatura", "Prata")
    ];
    expect(resolve("aneis", men.children![1].href, rings).products.map(({ id }) => id)).toEqual(["m"]);
    expect(resolve("aneis", women.children![1].href, rings).products.map(({ id }) => id)).toEqual(["f"]);
    expect(resolve("aneis", women.children![2].href, rings).products.map(({ id }) => id)).toEqual(["perola"]);
    expect(resolve("aneis", graduation.href, rings).products.map(({ id }) => id)).toEqual(["formatura"]);
  });

  it("filtra Correntes por subcategoria exata e pelo grupo público de Prata", () => {
    const [men, women] = bySlug("correntes").links;
    expect(men.children!.map((link) => link.href)).toEqual([
      "/categorias/correntes?subcategoria=correntes-masculinas&material=ouro-18k",
      "/categorias/correntes?subcategoria=correntes-masculinas&material=prata"
    ]);
    expect(women.children!.map((link) => link.href)).toEqual([
      "/categorias/correntes?subcategoria=correntes-femininas&material=ouro-18k",
      "/categorias/correntes?subcategoria=correntes-femininas&material=prata"
    ]);
    const matching = ["Prata", "Prata 925", "Prata 950"].map((material) =>
      item(material, "Correntes", "Correntes masculinas", material));
    const products = [...matching, item("f", "Correntes", "Correntes femininas", "Prata"),
      item("anel", "Anéis", "Masculino", "Prata"), item("pulseira", "Pulseiras", "Pulseiras em Prata", "Prata"),
      item("ouro", "Correntes", "Correntes masculinas", "Ouro 18k")];
    expect(resolve("correntes", men.children![1].href, products).products).toEqual(matching);
  });

  it("mantém subcategoria e materiais conhecidos selecionados mesmo sem resultados", () => {
    const [men, women] = bySlug("correntes").links;
    const onlySilverMen = item("m", "Correntes", "Correntes masculinas", "Prata");
    expect(resolve("correntes", women.children![1].href, [onlySilverMen])).toMatchObject({
      total: 0, query: { subcategoria: "correntes-femininas", material: "prata" }
    });
    expect(resolve("correntes", men.children![0].href, [onlySilverMen])).toMatchObject({
      total: 0, query: { subcategoria: "correntes-masculinas", material: "ouro-18k" }
    });
    const invalid = resolve("correntes", "/categorias/correntes?subcategoria=inexistente&material=inexistente", [onlySilverMen]);
    expect(invalid.products).toEqual([onlySilverMen]);
    expect(invalid.query.material).toBeUndefined();
    expect(invalid.query.subcategoria).toBeUndefined();
  });

  it.each([
    ["pulseiras", "Pulseiras", "Pulseiras Masculinas", "Pulseiras Femininas"],
    ["pingentes", "Pingentes", "\tPingentes Masculinos", "\tPingentes Femininos"]
  ] as const)("usa as subcategorias cadastradas de %s para gênero e material", (slug, category, male, female) => {
    const [men, women] = bySlug(slug).links;
    const terms = [
      [men, "Masculino", male, "masculin" + (slug === "pulseiras" ? "as" : "os")],
      [women, "Feminino", female, "feminin" + (slug === "pulseiras" ? "as" : "os")]
    ] as const;
    const products = [item("mo", category, male, "Ouro 18k"), item("mp", category, male, "Prata 925"),
      item("fo", category, female, "Ouro 18k"), item("fp", category, female, "Prata 950")];
    for (const [group, label, name, suffix] of terms) {
      const subcategory = `${slug}-${suffix}`;
      const base = `/categorias/${slug}?subcategoria=${subcategory}`;
      expect(group).toMatchObject({ label, href: base, children: [
        { label: "Ouro 18k", href: `${base}&material=ouro-18k` },
        { label: "Prata", href: `${base}&material=prata` }
      ] });
      expect(resolve(slug, group.children![0].href, products).products)
        .toEqual(products.filter((p) => p.subcategory === name && p.material === "Ouro 18k"));
      expect(resolve(slug, group.children![1].href, products).products)
        .toEqual(products.filter((p) => p.subcategory === name && p.material !== "Ouro 18k"));
      expect(resolve(slug, group.children![1].href, products.filter((p) => p.subcategory !== name))).toMatchObject({
        total: 0, query: { subcategoria: subcategory, material: "prata" }
      });
    }
  });

  it("deixa Infantil fora de gênero em Pulseiras", () => {
    const options = bySlug("pulseiras").links;
    expect(options.map((entry) => entry.label)).toEqual(["Masculino", "Feminino", "Infantil"]);
    expect(options[2]).toEqual({ label: "Infantil", href: "/categorias/pulseiras?subcategoria=pulseiras-infantis", children: undefined });
  });

  it.each([
    ["brincos", ["Ouro 18k", "Prata", "Infantil"]],
    ["braceletes", ["Ouro 18k", "Prata"]],
    ["relogios", ["Masculinos", "Femininos"]]
  ] as const)("mantém as entradas cadastradas de %s sem inventar gênero", (slug, labels) => {
    expect(bySlug(slug).links.map((entry) => entry.label)).toEqual(labels);
    expect(bySlug(slug).links.every((entry) => !entry.children)).toBe(true);
  });
});
