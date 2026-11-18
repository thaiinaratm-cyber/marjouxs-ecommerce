import { describe, expect, it } from "vitest";
import { catalogHref, discoverCatalog, hasDiscoveryParams, matchesEditorialVariant } from "@/lib/catalog/discovery";
import { categoryFilters } from "@/lib/category-navigation";
import { getRingProductSubcategorySlug, matchesRingMaterial } from "@/lib/ring-filters";
import type { Product } from "@/types/product";

function item(id: string, name: string, overrides: Partial<Product> = {}): Product {
  return {
    id, name, slug: id, category: "Alianças", subcategory: "Casamento", material: "Prata 950",
    images: ["/teste.webp"], price: 300, priceLabel: "R$ 300,00", installments: "", description: "Descrição em Ouro 18k.",
    stockStatus: "Disponível", featured: false, isCustomOrder: false, allowWhatsappQuote: true, ...overrides
  };
}

const products = [
  item("quote", "Aliança Imperial", { price: null, priceLabel: "Sob orçamento" }),
  item("mixed", "Aliança Prata Clássica", { material: "Prata 925", price: 550, subcategory: "Namoro" }),
  item("custom", "Aliança Clássica", { price: 160, stockStatus: "Disponível", catalogAvailability: "Sob encomenda",
    stoneCustomization: { options: ["esmeralda"] } }),
  item("ring", "Anel Selo", { price: 550, category: "Anéis", subcategory: "Masculino", material: "Ouro 18k" })
];

const ids = (result: ReturnType<typeof discoverCatalog>) => result.products.map(({ id }) => id);

describe("catálogo com filtros no servidor", () => {
  it("ordena nome exato, prefixo, trecho e taxonomia", () => {
    const items = [
      item("taxonomy", "Aurora"),
      item("contains", "Par Aliança Prata"),
      item("prefix", "Aliança Prata 950"),
      item("name", "Aliança Prata")
    ];
    expect(ids(discoverCatalog(items, { busca: "  ALIÁNÇA   Prata " }))).toEqual(["name", "prefix", "contains", "taxonomy"]);
    expect(ids(discoverCatalog(items, { busca: "Ouro 18k" }))).toEqual([]);
  });

  it("combina procura, categoria, subcategoria real, liga, preço, disponibilidade e pedra", () => {
    const { options, ...result } = discoverCatalog(products, {
      busca: "alianca prata", categoria: "aliancas", subcategoria: "casamento", material: "prata-950",
      min_price: "150,50", max_price: "300", disponibilidade: "sob-encomenda", pedra: "1", tipo_preco: "com-preco"
    });
    expect(ids({ ...result, options })).toEqual(["custom"]);
    expect(options.subcategories.aliancas.map(({ value }) => value)).toEqual(["casamento", "namoro"]);
    expect(options.subcategories.aneis.map(({ value }) => value)).toEqual(["masculino"]);
    expect(result.query.min_price).toBe("150.5");
    expect(result.chips).toHaveLength(9);
  });

  it("não mistura ligas pelo nome, descrição ou subcategoria de outro grupo", () => {
    const scoped = products.filter(({ category }) => category === "Alianças");
    const result = discoverCatalog(scoped, { subcategoria: "prata-950", categoria: "aneis" },
      { scoped: true, editorial: categoryFilters.aliancas });
    expect(ids(result)).toEqual(["quote", "custom"]);
    expect(result.query.categoria).toBeUndefined();
    expect(matchesRingMaterial(products[1], "prata-950")).toBe(false);
    expect(matchesRingMaterial(products[0], "ouro-18k")).toBe(false);
    expect(getRingProductSubcategorySlug(item("generic", "Anel masculino com pérola"))).toBeUndefined();
    expect(getRingProductSubcategorySlug(products[3])).toBe("masculino");
    expect(matchesEditorialVariant(item("child", "Brinco", { subcategory: "Brincos infantis" }), "infantil")).toBe(true);
    expect(matchesEditorialVariant(item("other", "Brinco infantil"), "infantil")).toBe(false);
  });

  it("não inventa preço para orçamento e só usa disponibilidade estruturada", () => {
    expect(ids(discoverCatalog(products, { tipo_preco: "sob-orcamento" }))).toEqual(["quote"]);
    expect(ids(discoverCatalog(products, { tipo_preco: "sob-orcamento", preco: "ate-300" }))).toEqual([]);
    expect(ids(discoverCatalog(products, { disponibilidade: "disponivel", max_price: "1000" }))).toEqual(["mixed", "ring"]);
    expect(ids(discoverCatalog([products[3]], { pedra: "1" }))).toEqual([]);
  });

  it("ordena de forma estável, com orçamento depois do último preço em ambas as direções", () => {
    expect(ids(discoverCatalog(products, { sort: "price_asc" }))).toEqual(["custom", "mixed", "ring", "quote"]);
    expect(ids(discoverCatalog(products, { ordem: "maior-preco" }))).toEqual(["mixed", "ring", "custom", "quote"]);
    expect(ids(discoverCatalog(products, { ordem: "nome-az" }))).toEqual(["custom", "quote", "mixed", "ring"]);
    expect(ids(discoverCatalog([item("b", "Aliança"), item("a", "Aliança")], { ordem: "nome-az" }))).toEqual(["a", "b"]);
  });

  it("ignora estados fabricados, parâmetros repetidos e limites inválidos", () => {
    const result = discoverCatalog(products, {
      categoria: "sem-categoria", disponibilidade: "em-estoque", material: ["prata-950", "ouro-18k"],
      subcategoria: "?", busca: ["a", "b"], min_price: "400", max_price: "300",
      ordem: "random()", pedra: "true", pagina: "-3"
    });
    expect(result.total).toBe(products.length);
    expect(result.currentPage).toBe(1);
    expect(result.chips).toEqual([]);
    expect(catalogHref("/produtos", result.query)).toBe("/produtos");
  });

  it("pagina resultados em ordem estável e mantém filtros ao construir os links", () => {
    const rows = Array.from({ length: 31 }, (_, n) => item(`${n}`, `Aliança ${String(n).padStart(2, "0")}`));
    const first = discoverCatalog(rows, { busca: "aliança", material: "Prata 950", ordem: "menor-preco" });
    const second = discoverCatalog(rows, { ...first.query, pagina: "2" });
    expect(first).toMatchObject({ total: 31, currentPage: 1, pageCount: 2 });
    expect(first.products).toHaveLength(24);
    expect(second.products).toHaveLength(7);
    expect(ids(second)[0]).toBe("24");
    expect(catalogHref("/produtos", second.query)).toBe("/produtos?busca=alian%C3%A7a&material=prata-950&ordem=menor-preco&pagina=2");
    expect(catalogHref("/produtos", { ...second.query, pagina: undefined })).not.toContain("pagina");
  });

  it("mantém a variante editorial indexável, mas não as combinações de navegação", () => {
    expect(hasDiscoveryParams({ subcategoria: "prata-950" }, "prata-950")).toBe(false);
    expect(hasDiscoveryParams({ subcategoria: "prata-950", pagina: "2" }, "prata-950")).toBe(true);
    expect(hasDiscoveryParams({ min_price: "160" })).toBe(true);
  });
});
