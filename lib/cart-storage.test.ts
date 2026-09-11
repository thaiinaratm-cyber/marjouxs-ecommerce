import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_VERSION,
  newCartLine,
  parseStoredCart,
  serializeCart
} from "@/lib/cart-storage";

describe("cart storage", () => {
  it("migra o carrinho legado sem confiar no objeto de preço salvo", () => {
    const legacy = JSON.stringify([
      {
        product: {
          id: "brinco-ponto-de-luz",
          slug: "brinco-ponto-de-luz",
          price: 0.01
        },
        quantity: 3
      }
    ]);

    expect(parseStoredCart(legacy)[0]).toMatchObject({
      productId: "brinco-ponto-de-luz",
      productSlug: "brinco-ponto-de-luz",
      quantity: 3,
      customization: null
    });
  });

  it("descarta produtos sem preço e força alianças legadas para quantidade um", () => {
    const noPrice = JSON.stringify([
      {
        product: {
          id: "aliancas-em-ouro-18k-anatomicas",
          slug: "aliancas-em-ouro-18k-anatomicas"
        },
        quantity: 2
      }
    ]);
    const alliance = JSON.stringify([
      {
        product: {
          id: "aliancas-em-ouro-18k-tradicional",
          slug: "aliancas-em-ouro-18k-tradicional"
        },
        quantity: 4
      }
    ]);

    expect(parseStoredCart(noPrice)).toEqual([]);
    expect(parseStoredCart(alliance)[0].quantity).toBe(1);
  });

  it("mantém produtos iguais em linhas diferentes quando configurados separadamente", () => {
    const first = newCartLine("aliancas-em-ouro-18k-tradicional", "aliancas-em-ouro-18k-tradicional", 1, {
      type: "ring_pair",
      ring1: { size: 18 },
      ring2: { size: 15 }
    });
    const second = newCartLine("aliancas-em-ouro-18k-tradicional", "aliancas-em-ouro-18k-tradicional", 1, {
      type: "ring_pair",
      ring1: { size: 20 },
      ring2: { size: 16 }
    });
    const serialized = serializeCart([first, second]);

    expect(JSON.parse(serialized).version).toBe(CART_STORAGE_VERSION);
    expect(parseStoredCart(serialized)).toHaveLength(2);
    expect(first.lineId).not.toBe(second.lineId);
  });
});
