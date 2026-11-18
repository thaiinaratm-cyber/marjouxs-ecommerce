import { describe, expect, it } from "vitest";
import { catalogHref, discoverCatalog, hasDiscoveryParams, matchesEditorialVariant } from "@/lib/catalog/discovery";
import { categoryFilters } from "@/lib/category-navigation";
import { toPublicMaterialFilterValue } from "@/lib/product-discovery";
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

const materialProducts = [
  item("silver", "Elo Uno", { material: "Prata", category: "Correntes", subcategory: "Clássicas", price: 190 }),
  item("silver925", "Elo Duplo", { material: "Prata 925", category: "Correntes", subcategory: "Clássicas", price: 250 }),
  item("silver950", "Elo Triplo", { material: "Prata 950", category: "Correntes", subcategory: "Masculino", price: 340 }),
  item("silverquote", "Elo Imperial", { material: "Prata 950", category: "Correntes", subcategory: "Clássicas",
    price: null, priceLabel: "Sob orçamento" }),
  item("gold", "Elo Solar", { material: "Ouro 18k", category: "Correntes" }),
  item("coin", "Elo Moeda", { material: "Moeda" }),
  item("plated", "Elo Banhado", { material: "Banhado a Ouro" }),
  item("unrelated", "Elo Fosco", { material: "Aço prateado" })
];

describe("faceta pública de material", () => {
  it.each([
    ["Prata 925", "prata"], [" PRÁTA_950 ", "prata"], ["Prata", "prata"],
    ["Ouro 18k", "ouro-18k"], ["Moeda", "moeda"], ["Banhado a Ouro", "banhado-a-ouro"],
    ["Aço prateado", "aco-prateado"], ["Prata 999", "prata-999"]
  ])("agrupa %s somente quando pertence à família explícita", (input, expected) => {
    expect(toPublicMaterialFilterValue(input)).toBe(expected);
  });

  it.each(["prata", "prata-925", "prata-950"])("resolve %s como Prata sem reescrever o teor técnico", (material) => {
    const result = discoverCatalog(materialProducts, { material, ordem: "menor-preco" });
    expect(result.total).toBe(4);
    expect(result.products).toEqual(materialProducts.slice(0, 4));
    expect(result.options.materials).toEqual([
      { label: "Aço prateado", value: "aco-prateado" }, { label: "Banhado a Ouro", value: "banhado-a-ouro" },
      { label: "Moeda", value: "moeda" }, { label: "Ouro 18k", value: "ouro-18k" }, { label: "Prata", value: "prata" }
    ]);
    expect(result.chips).toContainEqual({ label: "Prata", remove: { material: undefined } });
    expect(catalogHref("/produtos", result.query)).toBe("/produtos?material=prata&ordem=menor-preco");
  });

  it.each(["prata", "prata-925", "prata-950"])("mantém %s ativo e vazio quando nenhuma peça de prata é publicada", (material) => {
    const result = discoverCatalog([materialProducts[4]], { material, pagina: "2" });
    expect(result).toMatchObject({ total: 0, currentPage: 1, products: [], query: { material: "prata" } });
    expect(result.options.materials).toContainEqual({ label: "Prata", value: "prata" });
    expect(result.chips).toEqual([{ label: "Prata", remove: { material: undefined } }]);
  });

  it("aceita o alias 925 quando o catálogo tem somente Prata e Prata 950", () => {
    const result = discoverCatalog([materialProducts[0], materialProducts[2], materialProducts[4]], { material: "prata-925" });
    expect(ids(result)).toEqual(["silver", "silver950"]);
    expect(result.query.material).toBe("prata");
  });

  it("continua ignorando materiais desconhecidos e não cria opções a partir deles", () => {
    const result = discoverCatalog([materialProducts[4]], { material: "material-inexistente-xyz" });
    expect(result.query.material).toBeUndefined();
    expect(result.options.materials).toEqual([{ label: "Ouro 18k", value: "ouro-18k" }]);
    expect(ids(result)).toEqual(["gold"]);
  });

  it("combina Prata com categoria, subcategoria, preço, orçamento, busca e ordenação", () => {
    expect(ids(discoverCatalog(materialProducts, { material: "prata", categoria: "correntes",
      subcategoria: "classicas", max_price: "300", busca: "elo", ordem: "maior-preco" })))
      .toEqual(["silver925", "silver"]);
    expect(ids(discoverCatalog(materialProducts, { material: "prata", tipo_preco: "sob-orcamento" }))).toEqual(["silverquote"]);
    expect(ids(discoverCatalog(materialProducts, { material: "prata", busca: "prata 925" }))).toEqual(["silver925"]);
    expect(ids(discoverCatalog(materialProducts, { material: "prata", busca: "prata 950", ordem: "menor-preco" })))
      .toEqual(["silver950", "silverquote"]);
    expect(discoverCatalog(materialProducts, { material: "prata", busca: "prata" }).total).toBe(4);
  });
});

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
    expect(catalogHref("/produtos", second.query)).toBe("/produtos?busca=alian%C3%A7a&material=prata&ordem=menor-preco&pagina=2");
    expect(catalogHref("/produtos", { ...second.query, pagina: undefined })).not.toContain("pagina");
  });

  it("mantém a variante editorial indexável, mas não as combinações de navegação", () => {
    expect(hasDiscoveryParams({ subcategoria: "prata-950" }, "prata-950")).toBe(false);
    expect(hasDiscoveryParams({ subcategoria: "prata-950", pagina: "2" }, "prata-950")).toBe(true);
    expect(hasDiscoveryParams({ min_price: "160" })).toBe(true);
  });
});
