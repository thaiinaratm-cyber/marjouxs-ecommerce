import { describe, expect, it } from "vitest";
import {
  getProductCommercialDetails,
  getProductionDeadline,
  getProductTrustBenefits
} from "@/lib/product-merchandising";
import type { Product } from "@/types/product";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "produto-teste",
    name: "Produto teste",
    slug: "produto-teste",
    category: "Anéis",
    subcategory: "Feminino",
    material: "Ouro 18k",
    price: 990,
    priceLabel: "R$ 990,00",
    installments: "Até 12x",
    description: "Anel em Ouro 18k com acabamento polido.",
    images: ["/produtos/produto-teste.jpg"],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível",
    ...overrides
  };
}

describe("merchandising da página de produto", () => {
  it("aplica o prazo global a todas as joias sem usar prazo diferente da descrição", () => {
    const item = product({
      description: "Peça feita sob encomenda. Confeccionamos diversos modelos em até 3 dias."
    });

    expect(getProductionDeadline(item)).toBe("3 a 5 dias úteis");
    expect(getProductionDeadline(product())).toBe("3 a 5 dias úteis");
    expect(getProductionDeadline(product({ category: "Serviços", stockStatus: "Serviço" }))).toBeNull();
  });

  it("monta os dados comerciais reais de uma aliança", () => {
    const details = getProductCommercialDetails(product({
      category: "Alianças",
      subcategory: "Alianças Ouro 18k",
      isCustomOrder: true,
      stockStatus: "Sob encomenda",
      description: "Aliança feita sob encomenda em até 3 dias. Gravação dos nomes e caixinha inclusas."
    }));

    expect(details).toEqual(expect.arrayContaining([
      { kind: "material", label: "Material", value: "Ouro 18k" },
      { kind: "availability", label: "Disponibilidade", value: "Sob encomenda" },
      { kind: "sizing", label: "Numeração", value: "Escolha os dois aros abaixo" },
      { kind: "production", label: "Prazo de confecção", value: "3 a 5 dias úteis" },
      { kind: "pair", label: "Valor", value: "Referente ao par" },
      {
        kind: "included",
        label: "Inclusos",
        value: "Gravação dos nomes e caixinha de joia"
      }
    ]));
  });

  it("não inventa gravação, embalagem ou garantia para produto comum", () => {
    const kinds = getProductCommercialDetails(product()).map((detail) => detail.kind);

    expect(kinds).toEqual(["material", "availability", "production"]);
  });

  it("reconhece sob encomenda quando essa informação já está na descrição", () => {
    const details = getProductCommercialDetails(product({
      description: "Produto personalizado e confeccionado sob encomenda."
    }));

    expect(details.find((detail) => detail.kind === "availability")?.value).toBe("Sob encomenda");
    expect(getProductTrustBenefits(product({
      description: "Produto personalizado e confeccionado sob encomenda."
    }))).toContainEqual({ kind: "custom", label: "Produto sob encomenda" });
  });

  it("preserva indisponível mesmo quando a descrição menciona sob encomenda", () => {
    const unavailableProduct = product({
      stockStatus: "Indisponível",
      description: "Produto personalizado e confeccionado sob encomenda."
    });
    const details = getProductCommercialDetails(unavailableProduct);

    expect(details.find((detail) => detail.kind === "availability")?.value).toBe("Indisponível");
    expect(getProductTrustBenefits(unavailableProduct)).not.toContainEqual({
      kind: "custom",
      label: "Produto sob encomenda"
    });
  });

  it("limita o bloco de confiança a quatro benefícios relevantes", () => {
    const benefits = getProductTrustBenefits(product({
      isCustomOrder: true,
      stockStatus: "Sob encomenda"
    }));

    expect(benefits).toEqual([
      { kind: "secure", label: "Pagamento seguro" },
      { kind: "custom", label: "Produto sob encomenda" },
      { kind: "installments", label: "Até 12x" },
      { kind: "pix", label: "10% OFF no Pix" }
    ]);
  });
});
