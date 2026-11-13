import { describe, expect, it } from "vitest";
import { cartLineSchema, cartLinesSchema, ringPairCustomizationSchema, shippingLineSchema, shippingLinesSchema } from "@/lib/checkout/schemas";
import { getProductById, resolveCheckoutCart, resolveShipmentCart } from "@/lib/checkout/catalog";

const line = {
  productId: "brinco-ponto-de-luz", productSlug: "brinco-ponto-de-luz",
  quantity: 1, customization: null
};
const pair = {
  type: "ring_pair", ring1: { size: 18, engraving: "João ♥ Maria" },
  ring2: { size: 16, engraving: "Eternità ✨" }
};

describe("checkout input safety limits", () => {
  it.each([0, -1, 1.5, "2", null, 11, 1000000, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
  ("rejects invalid or out-of-limit quantity %j at both entry points", quantity => {
    expect(cartLineSchema.safeParse({ ...line, quantity }).success).toBe(false);
    const { customization: _customization, ...shipping } = line;
    expect(shippingLineSchema.safeParse({ ...shipping, quantity }).success).toBe(false);
    expect(() => resolveCheckoutCart([{ ...line, quantity } as typeof line])).toThrow();
    expect(() => resolveShipmentCart([{ ...shipping, quantity } as typeof shipping])).toThrow();
  });

  it.each([1, 10])("accepts bounded quantity %i without inventing stock", quantity => {
    expect(cartLineSchema.safeParse({ ...line, quantity }).success).toBe(true);
    expect(resolveCheckoutCart([{ ...line, quantity }]).subtotalCents).toBe(17990 * quantity);
  });

  it("rejects excessive engraving without truncating valid Unicode", () => {
    expect(ringPairCustomizationSchema.safeParse({ ...pair, ring1: { size: 18, engraving: "a".repeat(201) } }).success).toBe(false);
    expect(ringPairCustomizationSchema.parse(pair)).toEqual(pair);
    expect(ringPairCustomizationSchema.safeParse({ ...pair, ring1: { size: 18, engraving: "a".repeat(200) } }).success).toBe(true);
  });

  it.each([7, 36, 0, "18", null, 18.5])("rejects invalid pair size %j", size => {
    expect(ringPairCustomizationSchema.safeParse({ ...pair, ring1: { size } }).success).toBe(false);
  });

  it("requires two rings and rejects fabricated single-ring or extra fields", () => {
    expect(ringPairCustomizationSchema.safeParse({ type: "ring_pair", ring1: pair.ring1 }).success).toBe(false);
    expect(ringPairCustomizationSchema.safeParse({ ...pair, sale_unit: "unit" }).success).toBe(false);
  });
  it("splitting quantities into multiple lines cannot evade the checkout unit cap", () => {
    const lines = [{ ...line, quantity: 6 }, { ...line, quantity: 5 }];
    const shipping = lines.map(({ customization: _customization, ...item }) => item);
    expect(cartLinesSchema.safeParse(lines).success).toBe(false);
    expect(shippingLinesSchema.safeParse(shipping).success).toBe(false);
    expect(() => resolveCheckoutCart(lines)).toThrow();
    expect(() => resolveShipmentCart(shipping)).toThrow();
  });
  it("retains integer cents over repeated additions and rejects multiplication/sum overflow", () => {
    const product = getProductById(line.productId)!;
    const oneCent = () => ({ product: { ...product, price: 0.01 }, unitPriceCents: 1 });
    expect(resolveCheckoutCart(Array.from({ length: 10 }, () => line), oneCent).subtotalCents).toBe(10);
    const huge = () => ({ product, unitPriceCents: Number.MAX_SAFE_INTEGER });
    expect(() => resolveCheckoutCart([{ ...line, quantity: 2 }], huge)).toThrow(/limite/);
    expect(() => resolveShipmentCart([{ ...line, quantity: 2 }], huge)).toThrow(/limite/);
    expect(() => resolveCheckoutCart([line, line], huge)).toThrow(/subtotal/);
  });
});
