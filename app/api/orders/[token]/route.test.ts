import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicOrder } from "@/types/checkout";

const mocks = vi.hoisted(() => ({ getPublicOrder: vi.fn() }));

vi.mock("@/lib/checkout/orders", () => ({ getPublicOrder: mocks.getPublicOrder }));

import { GET } from "@/app/api/orders/[token]/route";
import { getGoogleAdsPurchase } from "@/lib/google-ads";

const token = "00000000-0000-4000-8000-000000000001";
const paidOrder: PublicOrder = {
  orderNumber: "MJ-000123",
  createdAt: "2026-09-29T12:00:00.000Z",
  paymentStatus: "paid",
  statusStage: "payment_approved",
  deliveryMethod: "pickup",
  shippingAddress: null,
  shippingCarrier: null,
  shippingService: null,
  shippingDeadlineDays: null,
  trackingCode: null,
  subtotalCents: 360000,
  shippingCents: 0,
  discountCents: 0,
  totalCents: 360000,
  paidAt: "2026-09-29T12:05:00.000Z",
  paymentMethod: "pix",
  installments: 1,
  receiptUrl: null,
  items: []
};

function fraudulentRequest(requestToken = token) {
  const query = new URLSearchParams({
    value: "999999",
    totalCents: "99999900",
    transaction_id: "FORGED-TRANSACTION",
    orderNumber: "FORGED-ORDER",
    paid: "true",
    status: "paid",
    paymentStatus: "paid",
    paidAt: "2026-09-29T12:05:00.000Z"
  });
  return new Request(
    `https://marjouxsjoias.com.br/api/orders/${encodeURIComponent(requestToken)}?${query}`
  );
}

describe("GET /api/orders/[token] como fonte da conversão", () => {
  beforeEach(() => mocks.getPublicOrder.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it.each(["", "MJ-000123", "not-a-uuid", "../pedido"])(
    "recusa token inválido %s sem consultar o pedido",
    async (invalidToken) => {
      const response = await GET(fraudulentRequest(invalidToken), { params: { token: invalidToken } });

      expect(response.status).toBe(404);
      expect(mocks.getPublicOrder).not.toHaveBeenCalled();
      const body = await response.json();
      expect(body).toMatchObject({ code: "order_not_found" });
      expect(getGoogleAdsPurchase(body)).toBeNull();
    }
  );

  it("não transforma UUID inexistente em compra por parâmetros da URL", async () => {
    mocks.getPublicOrder.mockResolvedValue(null);

    const response = await GET(fraudulentRequest(), { params: { token } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(mocks.getPublicOrder).toHaveBeenCalledOnce();
    expect(mocks.getPublicOrder).toHaveBeenCalledWith(token);
    expect(getGoogleAdsPurchase(body)).toBeNull();
  });

  it("retorna somente dados do backend sem cache e usa seu valor e identificador reais", async () => {
    mocks.getPublicOrder.mockResolvedValue(paidOrder);

    const response = await GET(fraudulentRequest(), { params: { token } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(mocks.getPublicOrder).toHaveBeenCalledOnce();
    expect(mocks.getPublicOrder).toHaveBeenCalledWith(token);
    expect(body).toEqual(paidOrder);
    expect(getGoogleAdsPurchase(body)).toEqual({
      send_to: "AW-18482833340/t-gCCNS624odELzPpu1E",
      value: 3600,
      currency: "BRL",
      transaction_id: "MJ-000123"
    });
  });

  it.each(["pending", "failed", "requires_review"] as const)(
    "não promove pagamento %s para pago com dados da URL",
    async (paymentStatus) => {
      const order = { ...paidOrder, paymentStatus, paidAt: null, statusStage: "received" };
      mocks.getPublicOrder.mockResolvedValue(order);

      const response = await GET(fraudulentRequest(), { params: { token } });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(order);
      expect(getGoogleAdsPurchase(body)).toBeNull();
    }
  );

  it("falha sem expor detalhes internos nem habilitar conversão", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getPublicOrder.mockRejectedValue(new Error("private-database-detail"));

    const response = await GET(fraudulentRequest(), { params: { token } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("private-database-detail");
    expect(getGoogleAdsPurchase(body)).toBeNull();
  });
});
