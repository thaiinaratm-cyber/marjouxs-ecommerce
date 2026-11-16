import { describe, expect, it } from "vitest";
import { newCartLine, parseStoredCart, serializeCart } from "@/lib/cart-storage";
import { resolveCheckoutCart } from "@/lib/checkout/catalog";
import { checkoutIntentSnapshot, getOrCreateCheckoutIntent } from "@/lib/checkout/intent";
import { checkoutRequestHash } from "@/lib/checkout/hash";
import { cartLineSchema } from "@/lib/checkout/schemas";
import { parseConfirmationOrder } from "@/lib/checkout/confirmation";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";
import { customizationLines } from "@/lib/orders/model";
import { shouldClearCartAfterPayment } from "@/lib/order-status";
import type { CartCustomization, Product } from "@/types/product";

const product: Product = {
  id: "stone-qa", slug: "stone-qa", name: "Peça QA", category: "Anéis", subcategory: "", material: "Prata 950",
  price: 160, priceLabel: "R$ 160,00", installments: "", description: "", images: ["/test.jpg"], featured: false,
  isCustomOrder: false, allowWhatsappQuote: true, stockStatus: "Disponível",
  stoneCustomization: { options: ["azul-safira", "esmeralda"] }
};
const sapphire = { type: "stone", stone_color: "azul-safira" } as const;
const emerald = { type: "stone", stone_color: "esmeralda" } as const;
const line = (customization: CartCustomization) => ({
  productId: product.id, productSlug: product.slug, quantity: 1, customization, displayedUnitPriceCents: 16000
});

describe("stone checkout contract", () => {
  it("validates allowed colors against the product without changing the price", () => {
    const resolver = () => ({ product });
    expect(resolveCheckoutCart([line(sapphire)], resolver)).toMatchObject({
      subtotalCents: 16000, items: [{ unitPriceCents: 16000, customization: sapphire }]
    });
    expect(() => resolveCheckoutCart([line(null)], resolver)).toThrow(/Selecione a cor/);
    expect(() => resolveCheckoutCart([line({ ...sapphire, stone_color: "rubi" })], resolver)).toThrow(/não está disponível/);
    const disabled = () => ({ product: { ...product, stoneCustomization: undefined } });
    expect(() => resolveCheckoutCart([line(sapphire)], disabled)).toThrow(/não está disponível/);
    expect(resolveCheckoutCart([line(null)], disabled).items[0].customization).toBeNull();
  });

  it("uses the exact shape and preserves the existing ring pair constraints", () => {
    const pair = { type: "ring_pair", ring1: { size: 17, engraving: "QA" }, ring2: { size: 21 } } as const;
    const ring = { ...pair, stone_color: "azul-safira" };
    const resolver = () => ({ product: { ...product, category: "Alianças" as const, saleUnit: "pair" as const } });
    expect(resolveCheckoutCart([line(ring)], resolver).items[0].customization).toEqual(ring);
    expect(cartLineSchema.safeParse({ ...line(sapphire), customization: { ...sapphire, extra: 1 } }).success).toBe(false);
    expect(cartLineSchema.safeParse({ ...line(ring), customization: { ...ring, ring1: { ...ring.ring1, extra: 1 } } }).success).toBe(false);
    expect(() => resolveCheckoutCart([line(sapphire)], resolver)).toThrow(/aros/);
    expect(() => resolveCheckoutCart([{ ...line(ring), quantity: 2 }], resolver)).toThrow(/quantidade 1/);
  });

  it("preserves distinct stones and names in storage and order views", () => {
    const a = newCartLine(product.id, product.slug, 1, sapphire, product);
    expect(parseStoredCart(serializeCart([a]))[0].customization).toEqual(sapphire);
    expect(customizationLines({ category: "Anéis", customization: sapphire })).toEqual(["Pedra: Azul Safira"]);
    expect(customizationLines({ category: "Anéis", customization: null })).toEqual([]);
    const item = confirmationFixture().items[0];
    const order = parseConfirmationOrder({
      ...confirmationFixture(), items: [{ ...item, productSlug: product.slug,
        customization: { type: "ring_pair", ring1: { engraving: "hidden" }, stone_color: sapphire.stone_color } }]
    });
    expect(order?.items[0].customization).toEqual(sapphire);
    expect(JSON.stringify(order)).not.toContain("hidden");
    expect(shouldClearCartAfterPayment("paid", [a], order!.items)).toBe(true);
    expect(shouldClearCartAfterPayment("paid", [{ ...a, customization: emerald }], order!.items)).toBe(false);
  });

  it("allocates a new request ID for a different stone with all totals unchanged", async () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    const purchase = { customer: { name: "QA", phone: "11000000000", email: "qa@example.invalid" },
      delivery: { method: "pickup" as const }, totalCents: 16000, shippingCents: 0, cartLineIds: ["same-line"] };
    const first = { ...purchase, items: [line(sapphire)] };
    const second = { ...purchase, items: [line(emerald)] };
    expect(checkoutRequestHash(checkoutIntentSnapshot(first))).not.toEqual(checkoutRequestHash(checkoutIntentSnapshot(second)));
    const a = await getOrCreateCheckoutIntent(storage, first);
    const b = await getOrCreateCheckoutIntent(storage, second);
    expect(a.fingerprint).not.toEqual(b.fingerprint);
    expect(a.requestId).not.toEqual(b.requestId);
    expect((await getOrCreateCheckoutIntent(storage, second)).requestId).toBe(b.requestId);
  });
});
