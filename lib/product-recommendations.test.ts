import { describe, expect, it } from "vitest";
import { resolveDatabaseRecommendations, selectRelatedProducts } from "@/lib/product-recommendations";
import type { Product } from "@/types/product";

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `Produto ${id}`,
    slug: id,
    category: "Anéis",
    subcategory: "Feminino",
    material: "Ouro 18k",
    price: 990,
    priceLabel: "R$ 990,00",
    installments: "Até 12x",
    description: "Produto para teste.",
    images: [`/produtos/${id}.jpg`],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível",
    ...overrides
  };
}

describe("selectRelatedProducts", () => {
  it("prioriza mesma categoria, material e subcategoria e exclui o item atual", () => {
    const current = product("atual");
    const candidates = [
      current,
      product("ouro-feminino"),
      product("ouro-masculino", { subcategory: "Masculino" }),
      product("prata-feminino", { material: "Prata 950", featured: true }),
      product("outra-categoria", { category: "Brincos" })
    ];

    expect(selectRelatedProducts(current, candidates, 3).map((item) => item.id)).toEqual([
      "ouro-feminino",
      "ouro-masculino",
      "prata-feminino"
    ]);
  });

  it("inclui solitário entre alianças relacionadas e usa aparador como complemento", () => {
    const current = product("alianca-atual", {
      category: "Alianças",
      subcategory: "Alianças Ouro 18k"
    });
    const candidates = [
      current,
      product("alianca-similar", {
        category: "Alianças",
        subcategory: "Alianças Ouro 18k"
      }),
      product("combo-solitario", {
        name: "Combo Alianças Ouro 18k + Anel Solitário",
        category: "Alianças",
        subcategory: "Alianças Ouro 18k"
      }),
      product("aparador", {
        name: "Anel Aparador em Ouro 18k",
        category: "Anéis"
      })
    ];

    expect(selectRelatedProducts(current, candidates, 4).map((item) => item.id)).toEqual([
      "alianca-similar",
      "combo-solitario",
      "aparador"
    ]);
  });

  it("respeita o limite solicitado", () => {
    const current = product("atual");
    const candidates = [current, product("a"), product("b"), product("c")];

    expect(selectRelatedProducts(current, candidates, 2)).toHaveLength(2);
    expect(selectRelatedProducts(current, candidates, 0)).toEqual([]);
  });

  it("não sugere infantil a adultos, produtos indisponíveis ou categorias sem afinidade", () => {
    const current = product("current", { subcategory: "Masculino" });
    expect(selectRelatedProducts(current, [
      product("infantil", { name: "Anel infantil" }),
      product("unavailable", { stockStatus: "Indisponível" }),
      product("wrong", { category: "Relógios" })
    ])).toEqual([]);
  });

  it("usa faixa de preço apenas para empatar produtos compatíveis e mantém itens sem preço quando adequados", () => {
    const current = product("current");
    const closer = product("z-closer", { price: 1000 });
    const distant = product("a-distant", { price: 2900 });
    const quote = product("b-quote", { price: null, priceLabel: "Sob orçamento" });
    const candidates = [distant, closer, quote];
    expect(selectRelatedProducts(current, candidates)).toEqual([closer, distant, quote]);
    const unpriced = selectRelatedProducts({ ...current, price: null }, candidates);
    expect(unpriced).toEqual([distant, quote, closer]);
    expect(unpriced[1].price).toBeNull();
    expect(selectRelatedProducts(current, candidates.slice().reverse())).toEqual([closer, distant, quote]);
  });
});

describe("database recommendation projection", () => {
  const current = product("current");
  const one = product("one");
  const two = product("two", { price: null, images: [] });
  it("keeps the manual order with no automatic completion, including quote-only targets", () => {
    expect(resolveDatabaseRecommendations(current, [one, two], [
      { mode: "automatic", related_slug: one.slug },
      { mode: "manual", related_slug: two.slug }, { mode: "manual", related_slug: one.slug }
    ])).toEqual({ mode: "manual", products: [two, one] });
    expect(resolveDatabaseRecommendations(current, [one, two], [
      { mode: "manual", related_slug: two.slug }, { mode: "automatic", related_slug: one.slug }
    ])).toEqual({ mode: "manual", products: [two] });
  });
  it("does not expose deactivated, self or stale targets and omits manual recommendations when none remain", () => {
    expect(resolveDatabaseRecommendations(current, [one, current], [
      { mode: "manual", related_slug: null }, { mode: "manual", related_slug: "unknown" },
      { mode: "manual", related_slug: current.slug }, { mode: "automatic", related_slug: one.slug }
    ])).toEqual({ mode: "manual", products: [] });
  });
  it("shows the vetted fallback when there are no manual rows", () => {
    expect(resolveDatabaseRecommendations(current, [one], [{ mode: "automatic", related_slug: one.slug }]))
      .toEqual({ mode: "automatic", products: [one] });
  });
});
