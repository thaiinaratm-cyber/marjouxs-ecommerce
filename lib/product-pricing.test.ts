import { describe, expect, it } from "vitest";
import { getProductPagePaymentSummary } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

function pricedProduct(price: number | null): Product {
  return {
    id: "produto-teste",
    name: "Produto teste",
    slug: "produto-teste",
    category: "Anéis",
    subcategory: "Feminino",
    material: "Ouro 18k",
    price,
    priceLabel: price ? `R$ ${price}` : "Sob orçamento",
    installments: "Até 12x",
    description: "Produto para teste de apresentação comercial.",
    images: ["/produtos/produto-teste.jpg"],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível"
  };
}

describe("getProductPagePaymentSummary", () => {
  it("calcula 12 parcelas e 10% de desconto no Pix para produto de baixo valor", () => {
    expect(getProductPagePaymentSummary(pricedProduct(360))).toEqual({
      installmentsCount: 12,
      installmentValue: 30,
      pixDiscountPercent: 10,
      pixPrice: 324
    });
  });

  it("arredonda as parcelas em centavos para produto de alto valor", () => {
    expect(getProductPagePaymentSummary(pricedProduct(3200))).toEqual({
      installmentsCount: 12,
      installmentValue: 266.67,
      pixDiscountPercent: 10,
      pixPrice: 2880
    });
  });

  it("mantém arredondamento monetário no Pix e nas parcelas", () => {
    expect(getProductPagePaymentSummary(pricedProduct(590))).toEqual({
      installmentsCount: 12,
      installmentValue: 49.17,
      pixDiscountPercent: 10,
      pixPrice: 531
    });
  });

  it("não cria resumo comercial para produto sem preço", () => {
    expect(getProductPagePaymentSummary(pricedProduct(null))).toBeNull();
  });
});
