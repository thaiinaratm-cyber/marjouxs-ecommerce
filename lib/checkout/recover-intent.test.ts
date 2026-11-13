import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), order: vi.fn(), attempt: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: mocks.admin }));
import { recoverCheckoutIntent } from "@/lib/checkout/recover-intent";
import { POST } from "@/app/api/checkout/intent/route";
const id = "00000000-0000-4000-8000-000000000001";
function request(payload: unknown, origin?: string) {
  return new Request("https://example.invalid/api/checkout/intent", { method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(payload) });
}
describe("read-only opaque recovery, no customer lookup or provider calls", () => {
  let queries: Array<{ table: string; fields?: string; eq?: [string, string] }>;
  beforeEach(() => {
    vi.clearAllMocks(); queries = [];
    mocks.order.mockResolvedValue({ data: { id, payment_status: "pending", order_status: "pending_payment" }, error: null });
    mocks.attempt.mockResolvedValue({ data: { status: "pending", checkout_url: "https://example.invalid/pay", provider_checkout_id: "private-provider-id" }, error: null });
    mocks.admin.mockReturnValue({ from: (table: string) => {
      const info = { table } as typeof queries[number]; queries.push(info);
      const query = { select: (fields: string) => { info.fields = fields; return query; },
        eq: (field: string, value: string) => { info.eq = [field, value]; return query; },
        order: () => query, limit: () => query, maybeSingle: table === "ecommerce_orders" ? mocks.order : mocks.attempt };
      return query;
    } });
  });
  it("recovers pending using only the exact opaque idempotency key", async () => {
    expect(await recoverCheckoutIntent(id)).toBe("pending");
    expect(queries[0].eq).toEqual(["checkout_idempotency_key", `checkout:${id}`]);
    expect(queries[0].fields).not.toMatch(/customer|email|phone|cpf|shipping/);
  });
  it("paid needs no attempt and cannot trigger payment_check", async () => {
    mocks.order.mockResolvedValue({ data: { id, payment_status: "paid", order_status: "preparing" }, error: null });
    expect(await recoverCheckoutIntent(id)).toBe("paid"); expect(mocks.attempt).not.toHaveBeenCalled();
  });
  it("missing attempt is blocked, not a fresh checkout", async () => {
    mocks.attempt.mockResolvedValue({ data: null, error: null }); expect(await recoverCheckoutIntent(id)).toBe("blocked");
  });
  it("unknown request is not recovered by PII or similar cart", async () => {
    mocks.order.mockResolvedValue({ data: null, error: null }); expect(await recoverCheckoutIntent(id)).toBe("new");
    expect(mocks.attempt).not.toHaveBeenCalled();
  });
  it("API exposes only a state, never PII, public tokens or checkout URLs", async () => {
    const response = await POST(request({ requestId: id }));
    expect(await response.json()).toEqual({ state: "pending" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("malformed and unknown identifiers get the same non-enumerating response", async () => {
    expect(await (await POST(request({ requestId: "1" }))).json()).toEqual({ state: "new" });
    mocks.order.mockResolvedValue({ data: null, error: null });
    expect(await (await POST(request({ requestId: id }))).json()).toEqual({ state: "new" });
  });
  it("rejects cross-origin reads without touching the database", async () => {
    expect((await POST(request({ requestId: id }, "https://other.invalid"))).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("database errors fail closed with a fixed sanitized code", async () => {
    mocks.order.mockResolvedValue({ data: null, error: { message: "private-token customer@example.invalid" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request({ requestId: id }));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: "checkout_recovery_unavailable" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-token|customer@/); log.mockRestore();
  });
});
