import { describe, expect, it } from "vitest";
import { discoverCatalog } from "@/lib/catalog/discovery";
import {
  getMaterialFilterOptions,
  searchProducts
} from "@/lib/product-discovery";
import type { Product } from "@/types/product";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "produto-teste",
    name: "Aliança Prata 950 Chanfrada",
    slug: "alianca-prata-950-chanfrada",
    category: "Alianças",
    subcategory: "Alianças de Prata",
    material: "Prata 950",
    price: 320,
    priceLabel: "R$ 320,00",
    installments: "Até 6x",
    description: "Modelo anatômico para casamento.",
    images: ["/produtos/produto.jpg"],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível",
    ...overrides
  };
}

describe("descoberta de produtos", () => {
  it("encontra termos parciais sem diferenciar acentuação", () => {
    const products = [product()];

    expect(searchProducts(products, "alianca")).toHaveLength(1);
    expect(searchProducts(products, "chANF")).toHaveLength(1);
    expect(searchProducts(products, "inexistente")).toHaveLength(0);
  });

  it("pesquisa categoria, subcategoria, material e slug, sem usar a descrição longa", () => {
    const item = product({ tags: ["presente especial"] });

    ["aliancas", "  ALIANÇA   prata ", "prata", "chanfrada", "de prata"].forEach((term) => {
      expect(searchProducts([item], term)).toHaveLength(1);
    });
    expect(searchProducts([item], "anatômico")).toEqual([]);
  });

  it("combina categoria, material e faixa de preço", () => {
    const products = [
      product(),
      product({ id: "anel-ouro", category: "Anéis", material: "Ouro 18k", price: 990 }),
      product({ id: "anel-prata", category: "Anéis", material: "Prata 950", price: 290 })
    ];

    expect(discoverCatalog(products, {
      categoria: "aneis", material: "prata-950", preco: "ate-300"
    }).products.map((item) => item.id)).toEqual(["anel-prata"]);
  });

  it("mantém as faixas de preço sem sobreposição nos limites", () => {
    const products = [
      product({ id: "300", price: 300 }),
      product({ id: "301", price: 301 }),
      product({ id: "500", price: 500 }),
      product({ id: "2000", price: 2000 }),
      product({ id: "2001", price: 2001 })
    ];

    expect(discoverCatalog(products, { preco: "ate-300" }).products.map((item) => item.id)).toEqual(["300"]);
    expect(discoverCatalog(products, { preco: "300-500" }).products.map((item) => item.id)).toEqual(["301", "500"]);
    expect(discoverCatalog(products, { preco: "acima-2000" }).products.map((item) => item.id)).toEqual(["2001"]);
  });

  it("oferece somente grupos de materiais de joias realmente presentes", () => {
    const options = getMaterialFilterOptions([
      product(),
      product({ id: "ouro", material: "Ouro 18k" }),
      product({ id: "servico", category: "Serviços", material: "Serviço técnico", stockStatus: "Serviço" })
    ]);

    expect(options).toEqual([
      { label: "Ouro 18k", value: "ouro-18k" },
      { label: "Prata", value: "prata" }
    ]);
  });
});
