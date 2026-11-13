import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { getOrCreateCheckoutIntent } from "@/lib/checkout/intent";
import type { CheckoutResult } from "@/lib/checkout/create-checkout";
import type { ValidatedCart } from "@/types/checkout";
import type { z } from "zod";
import type { createCheckoutSchema } from "@/lib/checkout/schemas";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  provider: vi.fn(),
  prepare: vi.fn(),
  cart: vi.fn(),
  shipping: vi.fn()
}));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc })
}));
vi.mock("@/lib/checkout/catalog-server", async (original) => ({
  ...await original<typeof import("@/lib/checkout/catalog-server")>(),
  resolveAuthoritativeCheckoutCart: mocks.cart
}));
vi.mock("@/lib/checkout/shipping", () => ({
  ShippingProviderError: class extends Error {
    constructor(message: string, readonly code: string, readonly status = 502) { super(message); }
  },
  quoteShipping: mocks.shipping
}));
vi.mock("@/lib/checkout/infinitepay", async (original) => ({
  ...await original<typeof import("@/lib/checkout/infinitepay")>(),
  prepareInfinitePayCheckout: mocks.prepare
}));

type Request = z.infer<typeof createCheckoutSchema>;
type Attempt = {
  id: string;
  status: "creating" | "pending" | "paid" | "failed" | "requires_review";
  url: string | null;
  providerId: string | null;
  dispatch: { state: "unclaimed" | "reserved" | "dispatched"; owner: string | null; lease: number } | null;
};
type Order = { id: string; key: string; hash: string; total: number; attempt: Attempt };
type RpcArguments = Record<string, unknown>;

const request: Request = {
  requestId: "00000000-0000-4000-8000-000000000001",
  items: [{ productId: "audit-fixture", productSlug: "audit-fixture", quantity: 1, customization: null }],
  customer: { name: "QA sintetico", email: "qa@example.invalid", phone: "11000000000", cpf: "" },
  delivery: { method: "pickup" }
};
const cart: ValidatedCart = {
  items: [{
    productId: "audit-fixture", productSlug: "audit-fixture", name: "Fixture QA",
    image: "/qa-not-a-real-product.webp", category: "Anéis", subcategory: null,
    material: "Ouro 18k", availability: "Disponível", unitPriceCents: 16000,
    quantity: 1, subtotalCents: 16000, customization: null
  }],
  subtotalCents: 16000
};

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

// Atomic mock of the installed RPC contract, shared across independent module instances.
function databaseModel() {
  const orders = new Map<string, Order>();
  const rpc = async (name: string, args: RpcArguments) => {
    if (name === "ecommerce_create_checkout") {
      const key = String(args.p_checkout_idempotency_key);
      let order = orders.get(key);
      if (order && order.hash !== args.p_request_hash) {
        return { data: null, error: { code: "23505", message: "Idempotency key was already used with another checkout payload" } };
      }
      if (!order) {
        const index = orders.size + 1;
        order = {
          id: `order-${index}`, key, hash: String(args.p_request_hash),
          total: (args.p_order as { total_cents: number }).total_cents,
          attempt: {
            id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
            status: "creating", url: null, providerId: null,
            dispatch: { state: "unclaimed", owner: null, lease: 0 }
          }
        };
        orders.set(key, order);
      }
      return { data: [{
        result_order_id: order.id, result_order_number: `MJ-${order.id}`,
        result_public_token: "00000000-0000-4000-8000-000000000099",
        result_payment_attempt_id: order.attempt.id, result_order_nsu: `MJ-${order.id}`,
        result_total_cents: order.total, result_attempt_status: order.attempt.status,
        result_checkout_url: order.attempt.url
      }], error: null };
    }
    const order = Array.from(orders.values()).find((row) => row.attempt.id === args.p_attempt_id);
    if (!order) throw new Error("Unexpected audit fixture attempt");
    const attempt = order.attempt;
    if (name === "ecommerce_fail_payment_attempt") {
      if (attempt.status !== "paid") attempt.status = args.p_requires_review ? "requires_review" : "failed";
      return { data: true, error: null };
    }
    if (name !== "ecommerce_checkout_link_transition") throw new Error("Unexpected RPC in isolated audit");
    const reply = (code: string) => ({ data: [{
      result_code: code, result_attempt_id: attempt.id, result_attempt_status: attempt.status,
      result_checkout_url: attempt.url, result_provider_checkout_id: attempt.providerId,
      result_lease_expires_at: attempt.dispatch?.lease ? new Date(attempt.dispatch.lease).toISOString() : null
    }], error: null });
    if (attempt.status === "paid") return reply("already_paid");
    if (attempt.status === "pending" && attempt.url && attempt.providerId) return reply("reuse_link");
    if (attempt.status !== "creating") return reply("attempt_not_available");
    const dispatch = attempt.dispatch;
    if (!dispatch) return reply("legacy_dispatch_unknown");
    if (args.p_action === "claim") {
      if (dispatch.state === "dispatched") return reply(dispatch.lease > Date.now() ? "in_progress" : "dispatch_uncertain");
      if (dispatch.state === "reserved" && dispatch.lease > Date.now()) return reply("in_progress");
      attempt.dispatch = { state: "reserved", owner: String(args.p_claim_token), lease: Date.now() + 120000 };
      return reply("reserved");
    }
    if (args.p_action === "begin_dispatch") {
      if (dispatch.state === "dispatched") return reply("dispatch_uncertain");
      if (dispatch.state !== "reserved" || dispatch.owner !== args.p_claim_token || dispatch.lease <= Date.now()) return reply("stale_claim");
      dispatch.state = "dispatched";
      return reply("dispatch_granted");
    }
    if (args.p_action !== "complete" || dispatch.state !== "dispatched" || dispatch.owner !== args.p_claim_token) return reply("stale_claim");
    let code = "registered";
    if (attempt.providerId && attempt.providerId !== args.p_provider_checkout_id) {
      attempt.status = "requires_review";
      code = "provider_checkout_id_conflict";
    } else {
      attempt.status = "pending";
      attempt.providerId = String(args.p_provider_checkout_id);
      attempt.url = String(args.p_checkout_url);
    }
    return reply(code);
  };
  return { orders, rpc };
}

async function instance() {
  // Each module owns a different attemptLocks Map; only the database/provider mocks are shared.
  vi.resetModules();
  return (await import("@/lib/checkout/create-checkout")).createCheckout;
}

describe("distributed idempotency integration (mock-only, installed RPC contract)", () => {
  let database: ReturnType<typeof databaseModel>;

  beforeEach(() => {
    database = databaseModel();
    mocks.rpc.mockReset().mockImplementation(database.rpc);
    mocks.cart.mockReset().mockResolvedValue(structuredClone(cart));
    mocks.shipping.mockReset();
    mocks.prepare.mockReset().mockImplementation((input: unknown) => () => mocks.provider(input));
    mocks.provider.mockReset().mockImplementation(async () => {
      const index = mocks.provider.mock.calls.length;
      return { providerCheckoutId: `mock-link-${index}`, checkoutUrl: `https://example.invalid/mock-link-${index}` };
    });
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Real network forbidden in idempotency audit"); }));
  });

  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("A: same module shares one provider operation for one order/attempt", async () => {
    const create = await instance();
    const gate = deferred();
    mocks.provider.mockImplementation(async () => {
      await gate.promise;
      return { providerCheckoutId: "mock-link-1", checkoutUrl: "https://example.invalid/mock-link-1" };
    });
    const first = create(structuredClone(request), "https://example.invalid");
    const second = create(structuredClone(request), "https://example.invalid");
    await vi.waitFor(() => expect(mocks.rpc.mock.calls.filter(([name]) => name === "ecommerce_create_checkout")).toHaveLength(2));
    gate.release();
    expect(await first).toEqual(await second);
    expect(database.orders.size).toBe(1);
    expect(Array.from(database.orders.values()).map((row) => row.attempt)).toHaveLength(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("B: independent module instances authorize only one provider call", async () => {
    const firstInstance = await instance();
    const secondInstance = await instance();
    expect(firstInstance).not.toBe(secondInstance);
    const gate = deferred();
    mocks.provider.mockImplementation(async () => {
      const index = mocks.provider.mock.calls.length;
      await gate.promise;
      return { providerCheckoutId: `mock-link-${index}`, checkoutUrl: `https://example.invalid/mock-link-${index}` };
    });
    const results = Promise.allSettled([
      firstInstance(structuredClone(request), "https://example.invalid"),
      secondInstance(structuredClone(request), "https://example.invalid")
    ]);
    await vi.waitFor(() => expect(mocks.provider).toHaveBeenCalledTimes(1));
    gate.release();
    expect((await results).map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(database.orders.size).toBe(1);
    expect(Array.from(database.orders.values())[0].attempt.status).toBe("pending");
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("C: refresh/new requestId creates two orders, attempts and provider links", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    await create({ ...structuredClone(request), requestId: "00000000-0000-4000-8000-000000000002" }, "https://example.invalid");
    expect(database.orders.size).toBe(2);
    expect(Array.from(database.orders.values()).map((row) => row.attempt)).toHaveLength(2);
    expect(mocks.provider).toHaveBeenCalledTimes(2);
  });

  it("refresh with the persisted intention reuses one order, one attempt and one link across instances", async () => {
    const data = new Map<string, string>();
    const tab = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const input = { ...request, items: request.items.map(item => ({ ...item, displayedUnitPriceCents: 16000 })), shippingCents: 0, totalCents: 16000 };
    let first: CheckoutResult | undefined;
    for (let refresh = 0; refresh < 4; refresh++) {
      const intent = await getOrCreateCheckoutIntent(tab, structuredClone(input), webcrypto as unknown as Crypto);
      const create = await instance();
      const result = await create({ ...structuredClone(request), requestId: intent.requestId }, "https://example.invalid");
      if (!first) first = result;
      expect(result).toEqual(first);
    }
    expect(database.orders.size).toBe(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    Array.from(database.orders.values())[0].attempt.status = "paid";
    const paidIntent = await getOrCreateCheckoutIntent(tab, input, webcrypto as unknown as Crypto);
    const create = await instance();
    expect(await create({ ...request, requestId: paidIntent.requestId }, "https://example.invalid")).toMatchObject({ alreadyPaid: true });
    expect(database.orders.size).toBe(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("a renewed shipping quote UUID preserves identity but a changed shipping price cannot reuse the old link", async () => {
    const shippingRequest: Request = { ...structuredClone(request), delivery: { method: "shipping", address: {
      postalCode: "07400805", street: "Rua QA", number: "1", complement: "", neighborhood: "Centro", city: "Arujá", state: "SP",
      serviceId: "2", shippingQuoteId: "00000000-0000-4000-8000-000000000010"
    } } };
    const quote = { shippingQuoteId: "00000000-0000-4000-8000-000000000010", serviceId: "2", serviceName: "SEDEX", carrierName: "Correios", priceCents: 994, deliveryTimeDays: 2, quotedAt: "2026-11-02T12:00:00Z" };
    mocks.shipping.mockResolvedValue([quote]);
    const firstInstance = await instance();
    const first = await firstInstance(shippingRequest, "https://example.invalid");
    if (shippingRequest.delivery.method !== "shipping") throw new Error("fixture");
    shippingRequest.delivery.address.shippingQuoteId = "00000000-0000-4000-8000-000000000011";
    mocks.shipping.mockResolvedValue([{ ...quote, shippingQuoteId: shippingRequest.delivery.address.shippingQuoteId }]);
    const nextInstance = await instance();
    expect(await nextInstance(shippingRequest, "https://example.invalid")).toEqual(first);
    expect(database.orders.size).toBe(1); expect(mocks.provider).toHaveBeenCalledTimes(1);
    mocks.shipping.mockResolvedValue([{ ...quote, priceCents: 1200 }]);
    await expect(nextInstance(shippingRequest, "https://example.invalid")).rejects.toMatchObject({ diagnostic: { error_code: "checkout_idempotency_conflict" } });
    expect(database.orders.size).toBe(1); expect(mocks.provider).toHaveBeenCalledTimes(1);
    await nextInstance({ ...shippingRequest, requestId: "00000000-0000-4000-8000-000000000099" }, "https://example.invalid");
    expect(database.orders.size).toBe(2); expect(mocks.provider).toHaveBeenCalledTimes(2);
  });

  it("D/E: retry on another instance reuses the persisted pending link", async () => {
    const firstInstance = await instance();
    const first = await firstInstance(structuredClone(request), "https://example.invalid");
    const restartedInstance = await instance();
    expect(await restartedInstance(structuredClone(request), "https://example.invalid")).toEqual(first);
    expect(database.orders.size).toBe(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("F: another instance cannot redispatch while the first HTTP is running", async () => {
    const create = await instance();
    const gate = deferred();
    mocks.provider.mockImplementationOnce(async () => {
      await gate.promise;
      return { providerCheckoutId: "mock-link-1", checkoutUrl: "https://example.invalid/mock-link-1" };
    });
    const outstanding = create(structuredClone(request), "https://example.invalid");
    await vi.waitFor(() => expect(mocks.provider).toHaveBeenCalledTimes(1));
    const restarted = await instance();
    await expect(restarted(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_in_progress" });
    gate.release();
    await expect(outstanding).resolves.toMatchObject({ alreadyPaid: false });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(database.orders.size).toBe(1);
  });

  it("G: crash after provider success cannot authorize another link", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    const order = Array.from(database.orders.values())[0];
    // Seed the durable state that would remain if this provider result had never reached PostgreSQL.
    order.attempt = { ...order.attempt, status: "creating", url: null, providerId: null };
    order.attempt.dispatch!.lease = 0;
    const restarted = await instance();
    await expect(restarted(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    expect(database.orders.size).toBe(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("H: same key with another hash is blocked before a second provider call", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    await expect(create({ ...structuredClone(request), customer: { ...request.customer, name: "Outra fixture" } }, "https://example.invalid"))
      .rejects.toMatchObject({ diagnostic: { error_code: "checkout_idempotency_conflict", postgres_code: "23505" } });
    expect(database.orders.size).toBe(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("paid attempts return confirmation without calling the provider again", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    Array.from(database.orders.values())[0].attempt.status = "paid";
    expect(await create(structuredClone(request), "https://example.invalid")).toMatchObject({ alreadyPaid: true });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("failed attempts are not automatically replaced for the same intention", async () => {
    const create = await instance();
    const { InfinitePayLinkError } = await import("@/lib/checkout/infinitepay");
    mocks.provider.mockRejectedValueOnce(new InfinitePayLinkError("Rejected", "payment_provider_error", 422, "rejected"));
    await expect(create(structuredClone(request), "https://example.invalid")).rejects.toThrow();
    expect(Array.from(database.orders.values())[0].attempt.status).toBe("failed");
    await expect(create(structuredClone(request), "https://example.invalid"))
      .rejects.toMatchObject({ publicCode: "checkout_link_state_invalid" });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("requires_review + refresh stays blocked across instances with no new link", async () => {
    const create = await instance(); await create(structuredClone(request), "https://example.invalid");
    const attempt = Array.from(database.orders.values())[0].attempt; attempt.status = "requires_review";
    for (let n = 0; n < 2; n++) {
      const refreshed = await instance();
      await expect(refreshed(structuredClone(request), "https://example.invalid"))
        .rejects.toMatchObject({ publicCode: "checkout_link_state_invalid" });
    }
    expect(database.orders.size).toBe(1); expect(attempt.status).toBe("requires_review"); expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("pending without a saved checkout URL never authorizes a replacement dispatch", async () => {
    const create = await instance(); await create(structuredClone(request), "https://example.invalid");
    Array.from(database.orders.values())[0].attempt.url = null;
    const refreshed = await instance();
    await expect(refreshed(structuredClone(request), "https://example.invalid"))
      .rejects.toMatchObject({ publicCode: "checkout_link_state_invalid" });
    expect(database.orders.size).toBe(1); expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("paid + back/repeat/two tabs remain one order and do not dispatch", async () => {
    const create = await instance(); await create(structuredClone(request), "https://example.invalid");
    const attempt = Array.from(database.orders.values())[0].attempt; attempt.status = "paid";
    const a = await instance(); const b = await instance();
    const results = await Promise.all([a(structuredClone(request), "https://example.invalid"), b(structuredClone(request), "https://example.invalid")]);
    expect(results.every(result => result.alreadyPaid)).toBe(true);
    expect(attempt.status).toBe("paid"); expect(database.orders.size).toBe(1); expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("the request hash includes authoritative shipping and rejects a stale total", async () => {
    const create = await instance();
    const deliveryRequest: Request = {
      ...structuredClone(request),
      delivery: { method: "shipping", address: {
        postalCode: "07400805", street: "Rua da fixture", number: "1", complement: "",
        neighborhood: "Fixture", city: "Arujá", state: "SP", serviceId: "2",
        shippingQuoteId: "00000000-0000-4000-8000-000000000050"
      } }
    };
    const quote = {
      shippingQuoteId: "00000000-0000-4000-8000-000000000051", serviceId: "2",
      carrierName: "Fixture", serviceName: "SEDEX", priceCents: 994,
      deliveryTimeDays: 2, quotedAt: "2026-10-22T12:00:00.000Z"
    };
    mocks.shipping.mockResolvedValueOnce([quote]).mockResolvedValueOnce([{ ...quote, priceCents: 1500 }]);
    await create(structuredClone(deliveryRequest), "https://example.invalid");
    await expect(create(structuredClone(deliveryRequest), "https://example.invalid"))
      .rejects.toMatchObject({ diagnostic: { error_code: "checkout_idempotency_conflict" } });
    const calls = mocks.rpc.mock.calls.filter(([name]) => name === "ecommerce_create_checkout");
    expect(calls[0][1].p_request_hash).not.toBe(calls[1][1].p_request_hash);
    expect(calls[1][1].p_order.total_cents).toBe(17500);
    expect(database.orders.size).toBe(1);
    expect(Array.from(database.orders.values())[0].total).toBe(16994);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it.each([2, 10, 100])("%i concurrent requests across independent modules dispatch once", async (count) => {
    const instances: Array<Awaited<ReturnType<typeof instance>>> = [];
    for (let index = 0; index < Math.min(count, 10); index++) instances.push(await instance());
    const gate = deferred();
    mocks.provider.mockImplementation(async () => {
      await gate.promise;
      return { providerCheckoutId: "one-link", checkoutUrl: "https://example.invalid/one-link" };
    });
    const results = Promise.allSettled(Array.from({ length: count }, (_, index) =>
      instances[index % instances.length](structuredClone(request), "https://example.invalid")));
    await vi.waitFor(() => {
      expect(mocks.rpc.mock.calls.filter(([name]) => name === "ecommerce_create_checkout")).toHaveLength(count);
      expect(mocks.provider).toHaveBeenCalledTimes(1);
    });
    gate.release();
    const settled = await results;
    expect(settled.some(row => row.status === "fulfilled")).toBe(true);
    for (const row of settled) if (row.status === "rejected") expect(row.reason.publicCode).toBe("checkout_link_in_progress");
    expect(database.orders.size).toBe(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.filter(([name,args]) => name === "ecommerce_checkout_link_transition" && args.p_action === "complete")).toHaveLength(1);
  }, 30000);

  it("only calls provider after dispatch_granted, and persists through complete alone", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    const transitions = mocks.rpc.mock.calls.filter(([name]) => name === "ecommerce_checkout_link_transition");
    expect(transitions.map(([,args]) => args.p_action)).toEqual(["claim", "begin_dispatch", "complete"]);
    expect(new Set(transitions.map(([,args]) => args.p_claim_token)).size).toBe(1);
    const dispatchIndex = mocks.rpc.mock.calls.findIndex(([name,args]) => name === "ecommerce_checkout_link_transition" && args.p_action === "begin_dispatch");
    const completeIndex = mocks.rpc.mock.calls.findIndex(([name,args]) => name === "ecommerce_checkout_link_transition" && args.p_action === "complete");
    expect(mocks.provider.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.rpc.mock.invocationCallOrder[dispatchIndex]);
    expect(mocks.provider.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[completeIndex]);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "ecommerce_set_checkout_link")).toBe(false);
  });

  it("preparation failure leaves a reservation recoverable after the lease", async () => {
    const first = await instance();
    mocks.prepare.mockImplementationOnce(() => { throw new Error("Synthetic pre-HTTP process failure"); });
    await expect(first(structuredClone(request), "https://example.invalid")).rejects.toThrow("pre-HTTP");
    const attempt = Array.from(database.orders.values())[0].attempt;
    expect(attempt.dispatch?.state).toBe("reserved");
    expect(mocks.provider).not.toHaveBeenCalled();
    const restarted = await instance();
    await expect(restarted(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_in_progress" });
    attempt.dispatch!.lease = 0;
    await expect(restarted(structuredClone(request), "https://example.invalid")).resolves.toMatchObject({ alreadyPaid: false });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("timeout after HTTP start preserves dispatched state and blocks retry", async () => {
    const create = await instance();
    mocks.provider.mockRejectedValueOnce(new DOMException("Synthetic timeout", "TimeoutError"));
    await expect(create(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    const attempt = Array.from(database.orders.values())[0].attempt;
    expect(attempt.status).toBe("creating");
    expect(attempt.dispatch?.state).toBe("dispatched");
    attempt.dispatch!.lease = 0;
    const restarted = await instance();
    await expect(restarted(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "ecommerce_fail_payment_attempt")).toBe(false);
  });

  it("legacy creating remains unchanged, with zero additional provider calls", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    const attempt = Array.from(database.orders.values())[0].attempt;
    Object.assign(attempt, { status: "creating", url: null, providerId: null, dispatch: null });
    const before = structuredClone(attempt);
    mocks.provider.mockClear();
    const restarted = await instance();
    await expect(restarted(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_legacy_unknown" });
    expect(attempt).toEqual(before);
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.some(([name]) => name === "ecommerce_fail_payment_attempt")).toBe(false);
  });

  it.each([false,true])("lost complete response (committed=%s) never redispatches", async (committed) => {
    const create = await instance();
    mocks.rpc.mockImplementation(async (name: string,args: RpcArguments) => {
      if (name === "ecommerce_checkout_link_transition" && args.p_action === "complete") {
        if (committed) await database.rpc(name,args);
        return { data: null,error: { code: "08006",message: "Private response lost" } };
      }
      return database.rpc(name,args);
    });
    await expect(create(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    const attempt = Array.from(database.orders.values())[0].attempt;
    attempt.dispatch!.lease = 0;
    const restarted = await instance();
    if (committed) await expect(restarted(structuredClone(request), "https://example.invalid")).resolves.toMatchObject({ checkoutUrl: "https://example.invalid/mock-link-1" });
    else await expect(restarted(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("missing transition RPC fails closed without the old provider path", async () => {
    const create = await instance();
    mocks.rpc.mockImplementation(async (name: string,args: RpcArguments) => name === "ecommerce_checkout_link_transition"
      ? { data: null,error: { code: "PGRST202",message: "secret-token qa@example.invalid" } }
      : database.rpc(name,args));
    await expect(create(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_unavailable" });
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("lost begin_dispatch response never sends HTTP or resets the committed dispatch", async () => {
    const create = await instance();
    mocks.rpc.mockImplementation(async (name: string,args: RpcArguments) => {
      const result = await database.rpc(name,args);
      return name === "ecommerce_checkout_link_transition" && args.p_action === "begin_dispatch"
        ? { data: null,error: { code: "08006" } } : result;
    });
    await expect(create(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    expect(mocks.provider).not.toHaveBeenCalled();
    const attempt = Array.from(database.orders.values())[0].attempt;
    expect(attempt.dispatch?.state).toBe("dispatched");
    attempt.dispatch!.lease = 0;
    const retry = await instance();
    await expect(retry(structuredClone(request), "https://example.invalid")).rejects.toMatchObject({ publicCode: "checkout_link_dispatch_uncertain" });
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("transition logs never serialize customer data or the claim owner token", async () => {
    const create = await instance();
    await create(structuredClone(request), "https://example.invalid");
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logs).not.toContain(request.customer.email);
    expect(logs).not.toContain(request.customer.phone);
    expect(logs).not.toContain(request.customer.name);
    for (const [name,args] of mocks.rpc.mock.calls) if (name === "ecommerce_checkout_link_transition") expect(logs).not.toContain(args.p_claim_token);
    expect(logs).toContain('provider_call_allowed');
  });
});
