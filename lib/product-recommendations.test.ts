import { describe, expect, it } from "vitest";
import { selectRelatedProducts } from "@/lib/product-recommendations";
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
});
