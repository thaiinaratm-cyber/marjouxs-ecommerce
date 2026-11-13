import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicOrder } from "@/types/checkout";
import { getGoogleAdsPurchase } from "@/lib/google-ads";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";
const mocks = vi.hoisted(() => ({ order: vi.fn() }));
vi.mock("@/lib/checkout/orders", () => ({ getPublicOrder: mocks.order }));
import { GET } from "@/app/api/orders/[token]/route";
const token = "00000000-0000-4000-8000-000000000099";
const request = new Request("https://example.invalid/api/orders/qa");
describe("confirmation token endpoint", () => {
  beforeEach(() => vi.clearAllMocks());
  it("invalid, incremental and absent tokens are indistinguishable from unknown UUIDs", async () => {
    mocks.order.mockResolvedValue(null);
    for (const value of ["1", "invalid", "", token]) {
      const response = await GET(request, { params: Promise.resolve({ token: value }) });
      expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Pedido não encontrado.", code: "order_not_found" });
    }
    expect(mocks.order).toHaveBeenCalledOnce();
  });
  it.each(["pending", "paid", "failed", "requires_review"])("returns authoritative %s without executing financial operations", async paymentStatus => {
    const order = confirmationFixture({ paymentStatus: paymentStatus as PublicOrder["paymentStatus"],
      paidAt: paymentStatus === "paid" ? "2026-11-04T12:01:00Z" : null });
    mocks.order.mockResolvedValue(order);
    const response = await GET(request, { params: Promise.resolve({ token }) });
    expect(await response.json()).toEqual(order); expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("projects away injected private fields even when the reader returns extra properties", async () => {
    mocks.order.mockResolvedValue({ ...confirmationFixture(), customer_email: "private@example.invalid", transaction_nsu: "private-nsu",
      provider_checkout_id: "private-provider", receiptUrl: "https://example.invalid/private-receipt", shippingAddress: { street: "private-address" } });
    const response = await GET(request, { params: Promise.resolve({ token }) });
    expect(JSON.stringify(await response.json())).not.toMatch(/private-|private@|transaction_nsu|customer_email|provider_checkout_id/);
  });
  it("does not serialize database errors or log bearer tokens", async () => {
    mocks.order.mockRejectedValue(new Error(`secret customer@example.invalid ${token}`));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request, { params: Promise.resolve({ token }) });
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json()) + JSON.stringify(log.mock.calls)).not.toMatch(/secret|customer@|00000000/);
    log.mockRestore();
  });
  it("100 synthetic guesses expose no previous order or financial data", async () => {
    mocks.order.mockResolvedValue(null);
    for (let n = 1; n <= 100; n++) {
      const guess = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      const response = await GET(request, { params: Promise.resolve({ token: guess }) });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Pedido não encontrado.", code: "order_not_found" });
    }
    expect(mocks.order).toHaveBeenCalledTimes(100);
  });
});

const paidOrder: PublicOrder = {
  orderNumber: "MJ-000123", createdAt: "2026-09-29T12:00:00.000Z",
  paymentStatus: "paid", statusStage: "payment_approved", deliveryMethod: "pickup",
  shippingAddress: null, shippingCarrier: null, shippingService: null,
  shippingDeadlineDays: null, trackingCode: null, subtotalCents: 360000,
  shippingCents: 0, discountCents: 0, totalCents: 360000,
  paidAt: "2026-09-29T12:05:00.000Z", paymentMethod: "pix", installments: 1,
  receiptUrl: null, items: []
};
function fraudulentRequest(requestToken = token) {
  const query = new URLSearchParams({ value: "999999", totalCents: "99999900",
    transaction_id: "FORGED-TRANSACTION", orderNumber: "FORGED-ORDER", paid: "true",
    status: "paid", paymentStatus: "paid", paidAt: "2026-09-29T12:05:00.000Z" });
  return new Request(`https://marjouxsjoias.com.br/api/orders/${encodeURIComponent(requestToken)}?${query}`);
}
describe("GET /api/orders/[token] como fonte da conversão (regressões preservadas)", () => {
  beforeEach(() => mocks.order.mockReset());
  afterEach(() => vi.restoreAllMocks());
  it.each(["", "MJ-000123", "not-a-uuid", "../pedido"])("recusa token inválido %s sem consultar o pedido", async invalidToken => {
    const response = await GET(fraudulentRequest(invalidToken), { params: Promise.resolve({ token: invalidToken }) });
    expect(response.status).toBe(404); expect(mocks.order).not.toHaveBeenCalled();
    const body = await response.json(); expect(body).toMatchObject({ code: "order_not_found" });
    expect(getGoogleAdsPurchase(body)).toBeNull();
  });
  it("não transforma UUID inexistente em compra por parâmetros da URL", async () => {
    mocks.order.mockResolvedValue(null);
    const response = await GET(fraudulentRequest(), { params: Promise.resolve({ token }) }); const body = await response.json();
    expect(response.status).toBe(404); expect(mocks.order).toHaveBeenCalledOnce();
    expect(mocks.order).toHaveBeenCalledWith(token); expect(getGoogleAdsPurchase(body)).toBeNull();
  });
  it("retorna somente dados do backend sem cache e usa seu valor e identificador reais", async () => {
    mocks.order.mockResolvedValue(paidOrder);
    const response = await GET(fraudulentRequest(), { params: Promise.resolve({ token }) }); const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(mocks.order).toHaveBeenCalledOnce(); expect(mocks.order).toHaveBeenCalledWith(token);
    expect(body).toEqual(paidOrder); expect(getGoogleAdsPurchase(body)).toEqual({
      send_to: "AW-18482833340/t-gCCNS624odELzPpu1E", value: 3600, currency: "BRL", transaction_id: "MJ-000123"
    });
  });
  it.each(["pending", "failed", "requires_review"] as const)("não promove pagamento %s para pago com dados da URL", async paymentStatus => {
    const order = { ...paidOrder, paymentStatus, paidAt: null, statusStage: "received" };
    mocks.order.mockResolvedValue(order);
    const response = await GET(fraudulentRequest(), { params: Promise.resolve({ token }) }); const body = await response.json();
    expect(response.status).toBe(200); expect(body).toEqual(order); expect(getGoogleAdsPurchase(body)).toBeNull();
  });
  it("falha sem expor detalhes internos nem habilitar conversão", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.order.mockRejectedValue(new Error("private-database-detail"));
    const response = await GET(fraudulentRequest(), { params: Promise.resolve({ token }) }); const body = await response.json();
    expect(response.status).toBe(503); expect(body).toMatchObject({ code: "order_read_unavailable" });
    expect(JSON.stringify(body)).not.toContain("private-database-detail"); expect(getGoogleAdsPurchase(body)).toBeNull();
  });
});
