import { describe, expect, it } from "vitest";
import { CheckoutValidationError, resolveCheckoutCart } from "@/lib/checkout/catalog";

const commonLine = {
  productId: "brinco-ponto-de-luz",
  productSlug: "brinco-ponto-de-luz",
  quantity: 2,
  customization: null
};

describe("resolveCheckoutCart", () => {
  it("recarrega preço e dados comerciais do catálogo", () => {
    const cart = resolveCheckoutCart([commonLine]);

    expect(cart.items[0]).toMatchObject({
      name: "Brinco Ponto de Luz",
      unitPriceCents: 17990,
      quantity: 2,
      subtotalCents: 35980
    });
    expect(cart.subtotalCents).toBe(35980);
  });

  it("rejeita produto sem preço positivo", () => {
    expect(() =>
      resolveCheckoutCart([
        {
          productId: "aliancas-em-ouro-18k-anatomicas",
          productSlug: "aliancas-em-ouro-18k-anatomicas",
          quantity: 1,
          customization: {
            type: "ring_pair",
            ring1: { size: 18 },
            ring2: { size: 16 }
          }
        }
      ])
    ).toThrowError(CheckoutValidationError);
  });

  it("mantém o preço da aliança como preço do par e preserva gravação Unicode", () => {
    const customization = {
      type: "ring_pair" as const,
      ring1: { size: 18, engraving: "João ♥ Maria" },
      ring2: { size: 15, engraving: "10/09/2026 ✨" }
    };
    const cart = resolveCheckoutCart([
      {
        productId: "aliancas-em-ouro-18k-tradicional",
        productSlug: "aliancas-em-ouro-18k-tradicional",
        quantity: 1,
        customization
      }
    ]);

    expect(cart.subtotalCents).toBe(320000);
    expect(cart.items[0].customization).toEqual(customization);
  });

  it("rejeita aro fora da faixa e quantidade maior que um para alianças", () => {
    const invalidSize = () =>
      resolveCheckoutCart([
        {
          productId: "aliancas-em-ouro-18k-tradicional",
          productSlug: "aliancas-em-ouro-18k-tradicional",
          quantity: 1,
          customization: {
            type: "ring_pair" as const,
            ring1: { size: 7 },
            ring2: { size: 15 }
          }
        }
      ]);
    const invalidQuantity = () =>
      resolveCheckoutCart([
        {
          productId: "aliancas-em-ouro-18k-tradicional",
          productSlug: "aliancas-em-ouro-18k-tradicional",
          quantity: 2,
          customization: {
            type: "ring_pair" as const,
            ring1: { size: 18 },
            ring2: { size: 15 }
          }
        }
      ]);

    expect(invalidSize).toThrow("Informe os dois aros");
    expect(invalidQuantity).toThrow("quantidade 1");
  });

  it("rejeita slug divergente mesmo com ID válido", () => {
    expect(() => resolveCheckoutCart([{ ...commonLine, productSlug: "produto-manipulado" }])).toThrow(
      "não foi encontrado"
    );
  });
});
