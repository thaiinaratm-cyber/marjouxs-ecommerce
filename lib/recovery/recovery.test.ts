import { afterEach, describe, expect, it, vi } from "vitest";
import { allocateRecovery, recordBrowserCheckoutRecovery } from "./browser";
import { recoveryInputSchema, recoveryPhoneSchema, recoverySnapshot, recoveryWhatsapp } from "./model";
import type { ValidatedCartItem } from "@/types/checkout";

const phone = "11987654321";
const id = "b7072e79-6664-4f43-80d6-814f24767779";
const getStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
};

describe("checkout recovery boundary", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(["+55 (11) 98765-4321", "(11) 98765-4321", "55 11 98765 4321", phone])("normalizes %s with checkout's phone rule", input => {
    expect(recoveryPhoneSchema.parse(input)).toBe(phone);
  });
  it.each(["119876543219", "+11 98765-4321", "invalid11987654321"])("does not truncate invalid %s into a customer", input => {
    expect(recoveryPhoneSchema.safeParse(input).success).toBe(false);
  });
  it("keeps one capability through reloads, line changes and removal; starts a new cart when all lines change", () => {
    const storage = getStorage();
    const first = allocateRecovery(storage, ["line-a", "line-b"], 1, () => "a");
    expect(allocateRecovery(storage, ["line-a", "line-b"], 2, () => "new")).toMatchObject({ seed: first?.seed, revision: 2 });
    expect(allocateRecovery(storage, ["line-b"], 3, () => "new")).toMatchObject({ seed: first?.seed, revision: 3, lineIds: ["line-b"] });
    expect(allocateRecovery(storage, [], 4, () => "new")).toMatchObject({ seed: first?.seed, revision: 4 });
    expect(allocateRecovery(storage, ["line-c"], 5, () => "next")).toMatchObject({ seed: "next", revision: 1 });
  });
  it("validates only the minimal contact data and forbids a financial association on an empty cart", () => {
    const input = { token: "a".repeat(64), revision: 1, phone, name: "", contactAllowed: false, deliveryMethod: "shipping", items: [] };
    expect(recoveryInputSchema.parse(input).name).toBeNull();
    for (const extra of [{ cpf: "000" }, { email: "nobody@example.test" }, { requestId: id }, { price: 1 }]) {
      expect(recoveryInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    }
  });
  it("keeps stone and ring variations distinct in the canonical snapshot without addresses or images", () => {
    const base = { productId: "gold", name: "Test", quantity: 1, unitPriceCents: 16000, image: "/img", productSlug: "gold",
      customization: { type: "ring_pair", stone_color: "cristal", ring1: { size: 15, engraving: "Ana" }, ring2: { size: 18 } }
    } as ValidatedCartItem;
    const snapshot = (line: ValidatedCartItem) => recoverySnapshot({ subtotalCents: 16000, items: [line] });
    expect(snapshot(base)[0]).not.toHaveProperty("image");
    expect(snapshot(base)).not.toEqual(snapshot({ ...base, customization: { type: "stone", stone_color: "esmeralda" } }));
    expect(snapshot(base)).not.toEqual(snapshot({ ...base, customization: { ...base.customization, type: "ring_pair", ring1: { size: 17 }, ring2: { size: 18 } } }));
  });
  it("never contacts without specific permission or after conversion", () => {
    expect(recoveryWhatsapp(phone, false, "abandoned")).toBeNull();
    expect(recoveryWhatsapp(phone, true, "converted")).toBeNull();
    expect(recoveryWhatsapp(phone, true, "review")).toBeNull();
    expect(recoveryWhatsapp(phone, true, "abandoned")).toMatch(/^https:\/\/wa\.me\/5511987654321\?text=/);
  });
  it("a failed capture resolves silently, with no change to the financial request ID", async () => {
    vi.stubGlobal("window", { localStorage: getStorage() });
    vi.stubGlobal("navigator", { locks: { request: async (_: string, fn: () => unknown) => fn() } });
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", send);
    const input = { phone, name: "Test", contactAllowed: false, deliveryMethod: "pickup" as const, lineIds: ["line-a"],
      items: [{ productId: "gold", productSlug: "gold", quantity: 1, customization: null }], requestId: id };
    await expect(recordBrowserCheckoutRecovery(input)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe("/api/checkout/recovery");
    expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject({ requestId: id, token: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });
});
