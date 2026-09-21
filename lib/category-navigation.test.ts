import { describe, expect, it } from "vitest";
import {
  getCategoryFilterHref,
  getProductCategoryFilter
} from "@/lib/category-navigation";
import type { Product } from "@/types/product";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "brinco-infantil",
    name: "Brinco Infantil em Ouro 18k",
    slug: "brinco-infantil-ouro-18k",
    category: "Brincos",
    subcategory: "Brincos infantis",
    material: "Ouro 18k",
    price: 990,
    priceLabel: "R$ 990,00",
    installments: "Até 12x sem juros",
    description: "Brinco infantil em ouro 18k.",
    images: ["/produtos/brinco-infantil-ouro-18k.png"],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível",
    ...overrides
  };
}

describe("navegação SEO de categorias", () => {
  it("prioriza a subcategoria comercial infantil sobre o material", () => {
    expect(getProductCategoryFilter("brincos", product())).toMatchObject({
      label: "Infantil",
      slug: "infantil"
    });
  });

  it("usa a rota limpa já existente para anéis", () => {
    const filter = getProductCategoryFilter(
      "aneis",
      product({ category: "Anéis", subcategory: "Feminino" })
    );

    expect(filter).toBeDefined();
    expect(getCategoryFilterHref("aneis", filter!)).toBe("/aneis/ouro-18k");
  });

  it("preserva a URL de subcategoria por query nas demais categorias", () => {
    const filter = getProductCategoryFilter(
      "aliancas",
      product({ category: "Alianças", subcategory: "Alianças Prata", material: "Prata 950" })
    );

    expect(filter).toBeDefined();
    expect(getCategoryFilterHref("aliancas", filter!)).toBe(
      "/categorias/aliancas?subcategoria=prata-950"
    );
  });
});
