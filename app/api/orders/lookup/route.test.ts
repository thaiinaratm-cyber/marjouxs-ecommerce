import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicOrderByCustomer: vi.fn()
}));

vi.mock("@/lib/checkout/orders", () => ({
  getPublicOrderByCustomer: mocks.getPublicOrderByCustomer
}));

import { POST } from "@/app/api/orders/lookup/route";

function lookupRequest(body: unknown) {
  return new Request("https://marjouxsjoias.com.br/api/orders/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const publicOrder = {
  orderNumber: "MJ-000123",
  createdAt: "2026-09-14T12:00:00.000Z",
  paymentStatus: "paid",
  statusStage: "payment_approved",
  deliveryMethod: "pickup",
  shippingAddress: null,
  shippingCarrier: null,
  shippingService: null,
  shippingDeadlineDays: null,
  trackingCode: null,
  subtotalCents: 10000,
  shippingCents: 0,
  discountCents: 0,
  totalCents: 10000,
  paidAt: "2026-09-14T12:05:00.000Z",
  paymentMethod: "pix",
  installments: 1,
  receiptUrl: null,
  items: []
};

describe("consulta pública de pedido", () => {
  beforeEach(() => {
    mocks.getPublicOrderByCustomer.mockReset();
  });

  it("normaliza número e e-mail antes da consulta", async () => {
    mocks.getPublicOrderByCustomer.mockResolvedValue(publicOrder);

    const response = await POST(
      lookupRequest({ orderNumber: " mj000123 ", email: " Cliente@Example.com " })
    );

    expect(response.status).toBe(200);
    expect(mocks.getPublicOrderByCustomer).toHaveBeenCalledWith(
      "MJ-000123",
      "cliente@example.com"
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("usa a mesma resposta para pedido inexistente e e-mail diferente", async () => {
    mocks.getPublicOrderByCustomer.mockResolvedValue(null);

    const first = await POST(
      lookupRequest({ orderNumber: "MJ-000123", email: "incorreto@example.com" })
    );
    const second = await POST(
      lookupRequest({ orderNumber: "MJ-999999", email: "cliente@example.com" })
    );

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    await expect(first.json()).resolves.toEqual(await second.json());
  });

  it("não devolve detalhes internos quando a consulta falha", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getPublicOrderByCustomer.mockRejectedValue(
      new Error("relation ecommerce_orders violated customer_email")
    );

    const response = await POST(
      lookupRequest({ orderNumber: "MJ-000123", email: "cliente@example.com" })
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).not.toContain("ecommerce_orders");
    expect(serialized).not.toContain("customer_email");
    expect(serialized).not.toContain("cliente@example.com");
    consoleError.mockRestore();
  });

  it("não consulta o banco quando a combinação está malformada", async () => {
    const response = await POST(lookupRequest({ orderNumber: "123", email: "invalido" }));

    expect(response.status).toBe(404);
    expect(mocks.getPublicOrderByCustomer).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: "order_not_found" });
  });
});
