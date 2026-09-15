import { describe, expect, it } from "vitest";
import { normalizeSortOrder, sortProducts } from "@/lib/product-sorting";
import type { Product } from "@/types/product";

function product(id: string, name: string): Product {
  return {
    id,
    name,
    slug: id,
    category: "Anéis",
    subcategory: "Feminino",
    material: "Ouro 18k",
    price: 100,
    priceLabel: "R$ 100,00",
    installments: "Até 12x",
    description: "Produto de teste.",
    images: [`/produtos/${id}.jpg`],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível"
  };
}

describe("ordenação de produtos", () => {
  it("reconhece e aplica nome A-Z com regras do português", () => {
    const products = [
      product("solitario", "Solitário"),
      product("alianca", "Aliança"),
      product("brinco", "Brinco")
    ];

    expect(normalizeSortOrder("nome-az")).toBe("nome-az");
    expect(sortProducts(products, "nome-az").map((item) => item.id)).toEqual([
      "alianca",
      "brinco",
      "solitario"
    ]);
  });
});
