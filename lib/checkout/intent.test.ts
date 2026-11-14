import { randomUUID, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECKOUT_INTENT_STORAGE_KEY, CHECKOUT_INTENT_TTL_MS, assertCheckoutIntentUsable,
  getOrCreateCheckoutIntent, prepareBrowserCheckoutIntent, type CheckoutIntentInput } from "@/lib/checkout/intent";

function storage(initial?: string) {
  const entries = new Map<string, string>(initial ? [[CHECKOUT_INTENT_STORAGE_KEY, initial]] : []);
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}
const cryptoImplementation = { subtle: webcrypto.subtle as Crypto["subtle"], randomUUID };
const purchase: CheckoutIntentInput = {
  customer: { name: "Cliente QA", email: "cliente@example.invalid", phone: "11000000000", cpf: "" },
  items: [{ productId: "qa", productSlug: "qa", quantity: 1, customization: null, displayedUnitPriceCents: 16000 }],
  delivery: { method: "pickup" }, shippingCents: 0, totalCents: 16000
};
const shipping = (): CheckoutIntentInput => ({ ...structuredClone(purchase), shippingCents: 994, totalCents: 16994,
  delivery: { method: "shipping", address: { postalCode: "07400805", street: "Rua QA", number: "1",
    complement: "", neighborhood: "Centro", city: "Arujá", state: "SP", serviceId: "2", shippingQuoteId: randomUUID() } } });

describe("checkout intention: temporary per-tab storage", () => {
  it("A/C: refresh and repeated retries keep one opaque identifier", async () => {
    const tab = storage();
    const first = await getOrCreateCheckoutIntent(tab, purchase, cryptoImplementation);
    for (let refresh = 0; refresh < 4; refresh++) {
      expect(await getOrCreateCheckoutIntent(tab, structuredClone(purchase), cryptoImplementation)).toEqual(first);
    }
  });
  it("stores only an opaque UUID and digest, never customer, cart or provider data", async () => {
    const tab = storage();
    const intent = await getOrCreateCheckoutIntent(tab, purchase, cryptoImplementation);
    const encoded = tab.getItem(`${CHECKOUT_INTENT_STORAGE_KEY}:${intent.fingerprint}`)!;
    expect(Object.keys(JSON.parse(encoded)).sort()).toEqual(["createdAt", "expiresAt", "fingerprint", "requestId", "version"]);
    for (const text of ["cliente@example.invalid", "Cliente QA", "11000000000", "checkoutUrl", "publicToken"]) {
      expect(encoded).not.toContain(text);
    }
  });
  it("D: independent tabs are independent; duplicated tabs preserve a copied intention", async () => {
    const firstTab = storage();
    const first = await getOrCreateCheckoutIntent(firstTab, purchase, cryptoImplementation);
    const second = await getOrCreateCheckoutIntent(storage(), purchase, cryptoImplementation);
    expect(second.requestId).not.toBe(first.requestId);
    const copiedTab = storage(firstTab.getItem(`${CHECKOUT_INTENT_STORAGE_KEY}:${first.fingerprint}`)!);
    expect(await getOrCreateCheckoutIntent(copiedTab, purchase, cryptoImplementation)).toEqual(first);
  });
  it("a new cart cycle can start an identical purchase without reusing the previous paid intention", async () => {
    const tab = storage();
    const first = await getOrCreateCheckoutIntent(tab, { ...purchase, cartLineIds: ["previous-cart-line"] }, cryptoImplementation);
    const refreshed = await getOrCreateCheckoutIntent(tab, { ...purchase, cartLineIds: ["previous-cart-line"] }, cryptoImplementation);
    expect(refreshed).toEqual(first);
    const newCart = await getOrCreateCheckoutIntent(tab, { ...purchase, cartLineIds: ["new-cart-line"] }, cryptoImplementation);
    expect(newCart.requestId).not.toBe(first.requestId);
  });
  it.each(["product", "quantity", "price", "personalization", "customer", "total"])("E: %s change replaces the intention", async (change) => {
    const tab = storage();
    const first = await getOrCreateCheckoutIntent(tab, purchase, cryptoImplementation);
    const next = structuredClone(purchase);
    if (change === "product") next.items[0].productSlug = "other-fixture";
    if (change === "quantity") next.items[0].quantity = 2;
    if (change === "price") next.items[0].displayedUnitPriceCents = 17000;
    if (change === "personalization") next.items[0].customization = { type: "ring_pair", ring1: { size: 17, engraving: "João ♥ Ana" }, ring2: { size: 21, engraving: "Sempre ∞" } };
    if (change === "customer") next.customer.email = "outro@example.invalid";
    if (change === "total") next.totalCents = 32000;
    expect((await getOrCreateCheckoutIntent(tab, next, cryptoImplementation)).requestId).not.toBe(first.requestId);
  });
  it.each(["zip", "service", "freight", "method"])("F: delivery %s change invalidates", async (change) => {
    const tab = storage();
    const firstInput = shipping();
    const first = await getOrCreateCheckoutIntent(tab, firstInput, cryptoImplementation);
    const next = structuredClone(firstInput);
    if (next.delivery.method !== "shipping") throw new Error("fixture");
    if (change === "zip") next.delivery.address.postalCode = "20040002";
    if (change === "service") next.delivery.address.serviceId = "other";
    if (change === "freight") { next.shippingCents = 2000; next.totalCents = 18000; }
    if (change === "method") { next.delivery = { method: "pickup" }; next.shippingCents = 0; next.totalCents = 16000; }
    expect((await getOrCreateCheckoutIntent(tab, next, cryptoImplementation)).requestId).not.toBe(first.requestId);
  });
  it("ignores renewed quote UUIDs and item ordering when commercial data stay equal", async () => {
    const tab = storage();
    const first = shipping();
    first.items.push({ ...first.items[0], productId: "qa-2", productSlug: "qa-2" });
    const next = structuredClone(first);
    if (next.delivery.method === "shipping") next.delivery.address.shippingQuoteId = randomUUID();
    next.items.reverse();
    expect(await getOrCreateCheckoutIntent(tab, next, cryptoImplementation))
      .toEqual(await getOrCreateCheckoutIntent(tab, first, cryptoImplementation));
  });
  it("fails closed before creating an order if storage is unavailable or corrupted", async () => {
    for (const tab of [storage("not JSON"), storage("null"), {
      getItem: () => { throw new Error("private browser data"); }, setItem: () => {}
    }, { getItem: () => null, setItem: () => { throw new Error("quota"); } }]) {
      await expect(getOrCreateCheckoutIntent(tab, purchase, cryptoImplementation)).rejects.toThrow("Não foi possível preservar");
    }
  });
});

describe("durable local intentions and expiry (no network)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("pending + closing/return: uses the same durable record, not a new lease", async () => {
    const local = storage();
    const first = await getOrCreateCheckoutIntent(local, purchase, cryptoImplementation, 1000);
    const reopened = await getOrCreateCheckoutIntent(local, purchase, cryptoImplementation, 2000);
    expect(reopened).toEqual(first);
    expect(reopened.expiresAt).toBe(1000 + CHECKOUT_INTENT_TTL_MS);
  });
  it("expired intent is retained as a read-only reference, never renewed automatically", async () => {
    const local = storage();
    const first = await getOrCreateCheckoutIntent(local, purchase, cryptoImplementation, 1000);
    const expired = await getOrCreateCheckoutIntent(local, purchase, cryptoImplementation, first.expiresAt);
    expect(expired).toEqual(first);
    expect(() => assertCheckoutIntentUsable(expired, "pending", first.expiresAt)).toThrow("prazo");
    expect(() => assertCheckoutIntentUsable(expired, "new", first.expiresAt)).toThrow("prazo");
    expect(() => assertCheckoutIntentUsable(expired, "paid", first.expiresAt)).toThrow("já está pago");
  });
  it("legacy V1 keeps the original ID without inventing a fresh creation date", async () => {
    const initial = await getOrCreateCheckoutIntent(storage(), purchase, cryptoImplementation, 1000);
    const legacy = storage(JSON.stringify({ version: 1, requestId: initial.requestId, fingerprint: initial.fingerprint }));
    const migrated = await getOrCreateCheckoutIntent(storage(), purchase, cryptoImplementation, 2000, legacy);
    expect(migrated).toMatchObject({ requestId: initial.requestId, createdAt: 0, expiresAt: 0 });
    expect(() => assertCheckoutIntentUsable(migrated, "pending", 2000)).toThrow("prazo");
  });
  it("two tabs share the same purchase but a material change cannot overwrite another purchase", async () => {
    const local = storage();
    const a = await getOrCreateCheckoutIntent(local, purchase, cryptoImplementation);
    const changed = structuredClone(purchase); changed.items[0].quantity = 2;
    const b = await getOrCreateCheckoutIntent(local, changed, cryptoImplementation);
    expect(b.requestId).not.toBe(a.requestId);
    expect(await getOrCreateCheckoutIntent(local, purchase, cryptoImplementation)).toEqual(a);
  });
  it("a two-unit checkout in either storage is not used for a corrected one-unit cart", async () => {
    const local = storage();
    const oldInput = { ...structuredClone(purchase), cartLineIds: ["same-line"], totalCents: 32000 };
    oldInput.items[0].quantity = 2;
    const old = await getOrCreateCheckoutIntent(local, oldInput, cryptoImplementation);
    const legacy = storage(JSON.stringify({ ...old, checkoutUrl: "https://checkout.infinitepay.io/old-fixture" }));
    const corrected = await getOrCreateCheckoutIntent(
      local, { ...purchase, cartLineIds: ["same-line"] }, cryptoImplementation, Date.now(), legacy
    );
    expect(corrected.requestId).not.toBe(old.requestId);
    expect(corrected.fingerprint).not.toBe(old.fingerprint);
    expect(corrected).not.toHaveProperty("checkoutUrl");
  });
  it.each(["paid", "requires_review", "failed", "legacy", "dispatch_unknown", "cancelled", "blocked"])("%s cannot open a checkout", async state => {
    const intent = await getOrCreateCheckoutIntent(storage(), purchase, cryptoImplementation);
    expect(() => assertCheckoutIntentUsable(intent, state)).toThrow();
  });
  it("pre-dispatch recovery and pending link reuse keep their existing ID", async () => {
    const intent = await getOrCreateCheckoutIntent(storage(), purchase, cryptoImplementation);
    for (const state of ["new", "pre_dispatch", "pending"]) expect(() => assertCheckoutIntentUsable(intent, state)).not.toThrow();
  });
  it("browser preflight serializes two tabs and only reads status, never dispatches", async () => {
    const local = storage(); let tail = Promise.resolve();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: storage() });
    vi.stubGlobal("navigator", { locks: { request: (_key: string, callback: () => Promise<unknown>) => {
      const result = tail.then(callback); tail = result.then(() => undefined, () => undefined); return result;
    } } });
    vi.stubGlobal("crypto", cryptoImplementation);
    const fetchMock = vi.fn(async () => Response.json({ state: "pending" })); vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([prepareBrowserCheckoutIntent(purchase), prepareBrowserCheckoutIntent(purchase)]);
    expect(a).toEqual(b);
    for (const [url, options] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).toBe("/api/checkout/intent");
      expect(JSON.parse(options.body as string)).toEqual({ requestId: a.requestId });
    }
    fetchMock.mockImplementation(async () => Response.json({ state: "paid" }));
    await expect(prepareBrowserCheckoutIntent(purchase)).rejects.toThrow("já está pago");
  });
  it("no Web Locks fails closed before any network call", async () => {
    vi.stubGlobal("navigator", {}); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(prepareBrowserCheckoutIntent(purchase)).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
  });
});
