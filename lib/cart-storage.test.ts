import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_VERSION,
  newCartLine,
  parseStoredCart,
  serializeCart
} from "@/lib/cart-storage";
import type { Product } from "@/types/product";

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

  it("preserva produto admin-only após recarregar a sacola, sem confiar nele no checkout", () => {
    const manual: Product = {
      id: "00000000-0000-4000-8000-000000000099",
      slug: "anel-admin",
      name: "Anel admin",
      category: "Anéis",
      subcategory: "Feminino",
      material: "Ouro 18k",
      price: 990,
      priceLabel: "R$ 990,00",
      installments: "12x sem juros",
      description: "",
      images: ["https://example.supabase.co/storage/v1/object/public/ecommerce-product-images/admin/anel.jpg"],
      featured: false,
      isCustomOrder: false,
      allowWhatsappQuote: true,
      stockStatus: "Disponível"
    };
    const stored = serializeCart([newCartLine(manual.id, manual.slug, 1, null, manual)]);
    expect(parseStoredCart(stored)[0].productSnapshot).toEqual(manual);
  });
});
