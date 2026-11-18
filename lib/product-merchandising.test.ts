import { describe, expect, it } from "vitest";
import { getProductionDeadline, getProductFaqTopics, isMadeToOrder } from "@/lib/product-merchandising";
import { buildProductInquiryUrl } from "@/lib/whatsapp";
import type { Product } from "@/types/product";

const product: Product = {
  id: "produto-teste", name: "Anel de teste", slug: "anel-teste", category: "Anéis", subcategory: "",
  material: "Ouro 18k", price: 990, priceLabel: "R$ 990,00", installments: "Até 12x",
  description: "", images: [], featured: false, isCustomOrder: false, allowWhatsappQuote: true, stockStatus: "Disponível"
};

describe("informações comerciais da PDP", () => {
  it("reaproveita o prazo global só para joias compráveis", () => {
    expect(getProductionDeadline(product)).toBe("3 a 5 dias úteis");
    expect(getProductionDeadline({ ...product, description: "Confeccionado em até 3 dias.", stockStatus: "Sob encomenda" }))
      .toBe("3 a 5 dias úteis");
    for (const unavailable of [
      { ...product, price: null },
      { ...product, category: "Relógios" },
      { ...product, stockStatus: "Indisponível" },
      { ...product, category: "Serviços", stockStatus: "Serviço" }
    ] satisfies Product[]) expect(getProductionDeadline(unavailable)).toBeNull();
  });

  it("mantém o reconhecimento legado de encomenda e preserva status explicitamente indisponível", () => {
    expect(isMadeToOrder({ ...product, description: "Peça confeccionada sob encomenda." })).toBe(true);
    expect(isMadeToOrder({ ...product, description: "Peça confeccionada sob encomenda.", stockStatus: "Indisponível" })).toBe(false);
  });

  it("usa só perguntas aplicáveis e não promete gravação ou pedra sem configuração", () => {
    expect(getProductFaqTopics(product)).toEqual(["sizing", "policies"]);
    expect(getProductFaqTopics({ ...product, category: "Pulseiras" })).toEqual(["policies"]);
    expect(getProductFaqTopics({ ...product, category: "Alianças", engravingAvailable: true, stoneCustomization: { options: ["esmeralda"] } }))
      .toEqual(["sizing", "engraving", "stone", "policies"]);
    expect(getProductFaqTopics({ ...product, category: "Alianças", engravingAvailable: false, stoneCustomization: { options: ["invalid"] } }))
      .toEqual(["sizing", "policies"]);
    expect(getProductFaqTopics({ ...product, price: null, stoneCustomization: { options: ["cristal"] } }))
      .toEqual(["sizing", "policies"]);
    expect(getProductFaqTopics({ ...product, category: "Serviços", stockStatus: "Serviço" })).toEqual([]);
    expect(getProductFaqTopics({ ...product, price: null, allowWhatsappQuote: false })).toEqual([]);
  });

  it("abre apenas uma mensagem contextual com produto e URL pública", () => {
    const contact = new URL(buildProductInquiryUrl(product, true));
    expect(contact.hostname).toBe("wa.me");
    expect(contact.searchParams.get("text")).toBe(
      "Olá, Marjouxs! Gostaria de solicitar um orçamento para Anel de teste.\nhttps://marjouxsjoias.com.br/produtos/anel-teste"
    );
    expect(new URL(buildProductInquiryUrl(product, false)).searchParams.get("text")).toContain("tirar uma dúvida");
  });
});
