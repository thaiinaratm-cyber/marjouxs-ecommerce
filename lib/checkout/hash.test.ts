import { describe, expect, it } from "vitest";
import { checkoutIdempotencyKey, checkoutRequestHash } from "@/lib/checkout/hash";

describe("checkout idempotency", () => {
  it("gera o mesmo hash independentemente da ordem das chaves", () => {
    expect(checkoutRequestHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      checkoutRequestHash({ a: { c: 3, d: 4 }, b: 2 })
    );
  });

  it("distingue payloads diferentes e deriva a chave do requestId", () => {
    expect(checkoutRequestHash({ quantity: 1 })).not.toBe(checkoutRequestHash({ quantity: 2 }));
    expect(checkoutIdempotencyKey("3f2a90a7-712f-4bc7-ac3a-536227af01a0")).toBe(
      "checkout:3f2a90a7-712f-4bc7-ac3a-536227af01a0"
    );
  });
});
