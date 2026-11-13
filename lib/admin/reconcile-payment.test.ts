import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), from: vi.fn(), rpc: vi.fn(), check: vi.fn(), enqueue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: mocks.auth }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock("@/lib/notifications/order-paid", () => ({ ensurePaidOrderEvent: mocks.enqueue }));
vi.mock("@/lib/checkout/infinitepay", async (original) => ({
  ...await original<typeof import("@/lib/checkout/infinitepay")>(), checkInfinitePayPayment: mocks.check
}));
import { reconcileAdminOrderPayment } from "@/lib/admin/reconcile-payment";
import { POST } from "@/app/api/payments/infinitepay/webhook/route";
import { InfinitePayError } from "@/lib/checkout/infinitepay";

const orderId = "00000000-0000-4000-8000-000000000001";
const attemptId = "00000000-0000-4000-8000-000000000002";
const paidCheck = { success: true, paid: true, amount: 16000, paid_amount: 16000, capture_method: "pix", installments: 1 };
function notice() {
  return new Request("https://example.invalid/api/payments/infinitepay/webhook", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_nsu: "fixture-order", invoice_slug: "fixture-invoice", transaction_nsu: "fixture-transaction" }) });
}

describe("manual reconciliation and webhook share the same payment path (mocks only)", () => {
  let order: { id: string; payment_status: string; order_status: string; payment_provider: string };
  let attempt: { id: string; order_id: string; order_nsu: string; status: string; requested_amount_cents: number;
    provider_checkout_id: string | null; transaction_nsu: string | null; receipt_url: null };
  let effectiveConfirmations: number;
  let events: Set<string>;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Real network forbidden"); }));
    order = { id: orderId, payment_status: "pending", order_status: "pending_payment", payment_provider: "infinitepay" };
    attempt = { id: attemptId, order_id: orderId, order_nsu: "fixture-order", status: "pending", requested_amount_cents: 16000,
      provider_checkout_id: "fixture-invoice", transaction_nsu: "fixture-transaction", receipt_url: null };
    effectiveConfirmations = 0; events = new Set();
    mocks.auth.mockResolvedValue({ userId: "fixture-admin" });
    mocks.admin.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
    mocks.from.mockImplementation((table: string) => {
      const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => ({
        data: structuredClone(table === "ecommerce_orders" ? order : attempt), error: null
      })) };
      for (const method of [q.select, q.eq, q.order, q.limit]) method.mockReturnValue(q);
      return q;
    });
    mocks.check.mockResolvedValue({ ...paidCheck });
    mocks.enqueue.mockImplementation(async () => { if (order.payment_status === "paid") events.add("order.paid"); });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "ecommerce_fail_payment_attempt") {
        if (order.payment_status !== "paid") { order.payment_status = "requires_review"; attempt.status = "requires_review"; }
        return { data: true, error: null };
      }
      if (name !== "ecommerce_confirm_payment") throw new Error("Unexpected mock RPC");
      const newlyPaid = order.payment_status !== "paid";
      if (newlyPaid) { effectiveConfirmations++; order.payment_status = "paid"; attempt.status = "paid"; events.add("ga4_purchase"); events.add("erp_financial"); }
      return { data: [{ result_code: newlyPaid ? "paid" : "already_paid", result_newly_paid: newlyPaid,
        result_order_id: orderId, result_order_number: "MJ-fixture", result_payment_status: "paid" }], error: null };
    });
  });
  afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it("A/B/G: missing webhook can be reconciled once; repeats and paid orders are no-ops", async () => {
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_paid");
    for (let n = 0; n < 3; n++) expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_already_paid");
    expect(effectiveConfirmations).toBe(1);
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(events).toEqual(new Set(["ga4_purchase", "erp_financial", "order.paid"]));
    expect(mocks.check).toHaveBeenCalledWith({ orderNsu: "fixture-order", invoiceSlug: "fixture-invoice", transactionNsu: "fixture-transaction", receiptUrl: null });
  });
  it("C: concurrent webhook and reconciliation yield one effective SQL confirmation and one of each event", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.check.mockImplementation(async () => { await gate; return { ...paidCheck }; });
    const outcomes = Promise.all([POST(notice()), reconcileAdminOrderPayment(orderId)]);
    await vi.waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(2));
    release();
    const [webhook, reconciliation] = await outcomes;
    expect(webhook.status).toBe(200);
    expect(["reconcile_paid", "reconcile_already_paid"]).toContain(reconciliation);
    expect(effectiveConfirmations).toBe(1);
    expect(events.size).toBe(3);
  });
  it.each([2, 10, 100])("%i concurrent webhook replays have one effective confirmation and unique events", async count => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.check.mockImplementation(async () => { await gate; return { ...paidCheck }; });
    const pending = Promise.all(Array.from({ length: count }, () => POST(notice())));
    await vi.waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(count));
    release();
    expect((await pending).every(response => response.status === 200)).toBe(true);
    expect(effectiveConfirmations).toBe(1);
    expect(events).toEqual(new Set(["ga4_purchase", "erp_financial", "order.paid"]));
    mocks.check.mockClear();
    expect((await POST(notice())).status).toBe(200);
    expect(mocks.check).not.toHaveBeenCalled();
    expect(effectiveConfirmations).toBe(1);
  });
  it.each([
    { amount: 15999 }, { paid_amount: 1 }, { paid_amount: 0 },
    { capture_method: "invalid" }, { capture_method: "pix", installments: 2 }
  ])("D: inconsistent financial response requires review, never confirms (%j)", async (fields) => {
    mocks.check.mockResolvedValue({ ...paidCheck, ...fields });
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_review");
    expect(order.payment_status).toBe("requires_review");
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment", expect.anything());
    expect(events.size).toBe(0);
  });
  it("E: unpaid stays pending and never enqueues", async () => {
    mocks.check.mockResolvedValue({ ...paidCheck, paid: false, paid_amount: 0 });
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_pending");
    expect(order.payment_status).toBe("pending"); expect(mocks.rpc).not.toHaveBeenCalled(); expect(events.size).toBe(0);
  });
  it.each(["timeout", "provider unavailable", "malformed JSON"])("F: %s cannot mark paid", async (reason) => {
    mocks.check.mockRejectedValue(new InfinitePayError("Safe provider error", reason, 503));
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_unavailable");
    expect(order.payment_status).toBe("pending"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["visitor", "non-admin", "inactive admin"])("rejects %s before using service role", async (identity) => {
    mocks.auth.mockRejectedValue(new Error(identity));
    await expect(reconcileAdminOrderPayment(orderId)).rejects.toThrow(identity);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled();
  });
  it("legacy creating/unknown dispatch remains intact", async () => {
    attempt.status = "creating"; attempt.transaction_nsu = null; attempt.provider_checkout_id = null;
    const before = structuredClone(attempt);
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_unavailable");
    expect(attempt).toEqual(before); expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["transaction_nsu", "provider_checkout_id"] as const)("missing persisted %s is blocked without provider call", async (field) => {
    attempt[field] = null;
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_missing_reference");
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("no financial or provider data can be accepted through an order identifier", async () => {
    expect(await reconcileAdminOrderPayment("invalid")).toBe("reconcile_unavailable");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("notification failure never rolls back a confirmed payment or serializes PII", async () => {
    mocks.enqueue.mockRejectedValue(new Error("secret-token customer@example.invalid"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_paid");
    expect(order.payment_status).toBe("paid");
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-token|customer@example/);
  });
  it("RPC transport errors produce safe webhook errors and no fabricated confirmation", async () => {
    mocks.rpc.mockRejectedValue(new Error("secret-token customer@example.invalid"));
    const response = await POST(notice());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Não foi possível registrar a confirmação do pagamento.", code: "payment_confirmation_unavailable" });
    expect(order.payment_status).toBe("pending"); expect(events.size).toBe(0);
  });
  it("a late divergent reconciliation cannot downgrade an order confirmed by the webhook", async () => {
    mocks.check.mockImplementation(async () => {
      order.payment_status = "paid"; attempt.status = "paid";
      return { ...paidCheck, paid_amount: 1 };
    });
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_review");
    expect(order.payment_status).toBe("paid"); expect(attempt.status).toBe("paid");
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment", expect.anything());
  });
  it("persisted reference conflicts never reach the provider or financial RPC", async () => {
    const wrongNotice = new Request("https://example.invalid/webhook", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_nsu: "fixture-order", invoice_slug: "wrong-invoice", transaction_nsu: "fixture-transaction" }) });
    expect((await POST(wrongNotice)).status).toBe(409);
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("known financial review can be rechecked only against the provider, never manual values", async () => {
    order.payment_status = "requires_review"; order.order_status = "requires_review"; attempt.status = "requires_review";
    Object.assign(attempt, { failure_code: "payment_amount_mismatch" });
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_paid");
    expect(mocks.check).toHaveBeenCalledOnce(); expect(effectiveConfirmations).toBe(1);
  });
  it.each(["provider_identifier_conflict", "transaction_nsu_conflict", "unknown"])("review for %s stays manual", async failure_code => {
    order.payment_status = "requires_review"; attempt.status = "requires_review"; Object.assign(attempt, { failure_code });
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_unavailable");
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("review without transaction reference stays blocked under the current schema", async () => {
    order.payment_status = "requires_review"; attempt.status = "requires_review"; attempt.transaction_nsu = null;
    Object.assign(attempt, { failure_code: "payment_amount_mismatch" });
    expect(await reconcileAdminOrderPayment(orderId)).toBe("reconcile_missing_reference"); expect(mocks.check).not.toHaveBeenCalled();
  });
});
