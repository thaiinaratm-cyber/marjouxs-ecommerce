import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  paymentCheck: vi.fn(),
  rpc: vi.fn(),
  enqueue: vi.fn(),
  confirmationCode: "paid",
  attempt: {
    id: "00000000-0000-4000-8000-000000000003",
    requested_amount_cents: 99000,
    provider_checkout_id: "fatura-1",
    transaction_nsu: null as string | null,
    status: "pending"
  }
}));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: (_field: string, value: string) => ({
          maybeSingle: async () => ({ data: value === "unknown-order" ? null : mocks.attempt, error: null })
        })
      })
    }),
    rpc: mocks.rpc
  })
}));
vi.mock("@/lib/notifications/order-paid", () => ({ ensurePaidOrderEvent: mocks.enqueue }));

vi.mock("@/lib/checkout/infinitepay", () => {
  class InfinitePayError extends Error {
    constructor(
      message: string,
      readonly code: string,
      readonly status = 502
    ) {
      super(message);
    }
  }

  return {
    InfinitePayError,
    checkInfinitePayPayment: mocks.paymentCheck
  };
});

import { POST } from "@/app/api/payments/infinitepay/webhook/route";

function webhookRequest() {
  return new Request("https://marjouxsjoias.com.br/api/payments/infinitepay/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invoice_slug: "fatura-1",
      transaction_nsu: "transacao-1",
      order_nsu: "MJ-000001",
      receipt_url: "https://example.com/recibo"
    })
  });
}

describe("InfinitePay webhook", () => {
  beforeEach(() => {
    mocks.enqueue.mockResolvedValue(true);
    mocks.confirmationCode = "paid";
    mocks.attempt.requested_amount_cents = 99000;
    mocks.attempt.status = "pending";
    mocks.attempt.provider_checkout_id = "fatura-1";
    mocks.attempt.transaction_nsu = null;
    mocks.paymentCheck.mockResolvedValue({
      success: true,
      paid: true,
      amount: 99000,
      paid_amount: 99000,
      installments: 1,
      capture_method: "pix"
    });
    mocks.rpc.mockImplementation(async (operation: string) => {
      if (operation === "ecommerce_confirm_payment") {
        return {
          data: [
            {
              result_code: mocks.confirmationCode,
              result_newly_paid: mocks.confirmationCode === "paid",
              result_order_id: "00000000-0000-4000-8000-000000000001",
              result_order_number: "MJ-000001",
              result_payment_status: "paid"
            }
          ],
          error: null
        };
      }
      return { data: true, error: null };
    });
  });

  it("confirma somente após payment_check oficial válido", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.paymentCheck).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "ecommerce_confirm_payment",
      expect.objectContaining({
        p_payment_verified: true,
        p_check_success: true,
        p_check_paid: true,
        p_amount_cents: 99000,
        p_paid_amount_cents: 99000
      })
    );
  });

  it("trata webhook repetido como sucesso idempotente", async () => {
    mocks.confirmationCode = "already_paid";
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, code: "already_paid" });
  });

  it("não modifica pagamento quando a RPC identifica transaction_nsu divergente", async () => {
    mocks.confirmationCode = "transaction_nsu_conflict";
    const response = await POST(webhookRequest());

    expect(response.status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_confirm_payment", expect.any(Object));
  });

  it("bloqueia valor manipulado antes de chamar a confirmação", async () => {
    mocks.paymentCheck.mockResolvedValue({
      success: true,
      paid: true,
      amount: 98000,
      paid_amount: 98500,
      installments: 1,
      capture_method: "pix"
    });
    const response = await POST(webhookRequest());

    expect(response.status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "ecommerce_fail_payment_attempt",
      expect.objectContaining({ p_requires_review: true, p_failure_code: "payment_amount_mismatch" })
    );
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment", expect.any(Object));
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it("falha de enqueue não reverte nem invalida pagamento confirmado", async () => {
    mocks.enqueue.mockRejectedValue(new Error("email@example.invalid secret-token"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(webhookRequest());
      expect(response.status).toBe(200);
      expect(JSON.stringify(log.mock.calls)).not.toContain("email@example.invalid");
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret-token");
    } finally { log.mockRestore(); }
  });
  it("pagamento não confirmado não gera evento", async () => {
    mocks.paymentCheck.mockResolvedValue({ success: true, paid: false, amount: 99000, paid_amount: 0 });
    expect((await POST(webhookRequest())).status).toBe(400);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["pix", "credit_card"])("confirma base exata de produtos + frete (%s)", async (method) => {
    mocks.attempt.requested_amount_cents = 52885;
    const paidAmount = 52885;
    mocks.paymentCheck.mockResolvedValue({ success: true, paid: true, amount: 52885,
      paid_amount: paidAmount, installments: 1, capture_method: method });
    expect((await POST(webhookRequest())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_confirm_payment", expect.objectContaining({
      p_amount_cents: 52885, p_paid_amount_cents: paidAmount, p_capture_method: method
    }));
  });

  it("base sem frete não confirma pedido cujo valor esperado inclui frete", async () => {
    mocks.attempt.requested_amount_cents = 52885;
    mocks.paymentCheck.mockResolvedValue({ success: true, paid: true, amount: 50000,
      paid_amount: 50000, installments: 1, capture_method: "pix" });
    expect((await POST(webhookRequest())).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment", expect.any(Object));
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    { paid_amount: 14400, capture_method: "pix", installments: 1 },
    { paid_amount: 16800, capture_method: "credit_card", installments: 3 }
  ])("preserves the official original and paid amounts for $capture_method", async fields => {
    mocks.attempt.requested_amount_cents = 16000;
    mocks.paymentCheck.mockResolvedValue({ success:true,paid:true,amount:16000,...fields });
    expect((await POST(webhookRequest())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_confirm_payment", expect.objectContaining({
      p_order_nsu:"MJ-000001",p_provider_checkout_id:"fatura-1",p_transaction_nsu:"transacao-1",
      p_amount_cents:16000,p_paid_amount_cents:fields.paid_amount,p_capture_method:fields.capture_method,
      p_installments:fields.installments,p_payment_verified:true,p_check_success:true,p_check_paid:true
    }));
  });

  it.each([0,-1,1.5,"14400",undefined])("reviews invalid paid_amount=%j before confirmation", async paid_amount => {
    const code = "payment_paid_amount_invalid";
    mocks.attempt.requested_amount_cents = 16000;
    mocks.paymentCheck.mockResolvedValue({ success:true,paid:true,amount:16000,paid_amount,installments:1,capture_method:"pix" });
    const response = await POST(webhookRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code});
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_fail_payment_attempt",expect.objectContaining({p_requires_review:true,p_failure_code:code}));
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment",expect.any(Object));
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("does not accept a forged notice amount instead of the official payment_check result", async () => {
    mocks.attempt.requested_amount_cents = 100000;
    mocks.paymentCheck.mockResolvedValue({ success:true,paid:true,amount:99999,paid_amount:90000,installments:1,capture_method:"pix" });
    const request = new Request("https://marjouxsjoias.com.br/api/payments/infinitepay/webhook",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({invoice_slug:"fatura-1",transaction_nsu:"transacao-1",order_nsu:"MJ-000001",amount:100000,paid_amount:100000})
    });
    expect((await POST(request)).status).toBe(409);
    expect(mocks.paymentCheck).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment",expect.any(Object));
  });

  it("unknown method and incompatible installments never reach confirmation", async () => {
    for (const fields of [{capture_method:"unknown",installments:1},{capture_method:"pix",installments:2}]) {
      mocks.paymentCheck.mockResolvedValue({success:true,paid:true,amount:99000,paid_amount:99000,...fields});
      expect((await POST(webhookRequest())).status).toBe(409);
    }
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment",expect.any(Object));
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it.each([false,true])("failed review persistence (transport=%s) fails closed without leaking errors", async transport => {
    mocks.paymentCheck.mockResolvedValue({success:true,paid:true,amount:99000,paid_amount:0,capture_method:"pix",installments:1});
    mocks.rpc.mockImplementation(async () => {
      if (transport) throw new Error("secret-token customer@example.invalid");
      return { data:null,error:{message:"secret-token customer@example.invalid"} };
    });
    const log = vi.spyOn(console,"error").mockImplementation(() => {});
    try {
      const response = await POST(webhookRequest());
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({code:"payment_review_unavailable"});
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret-token");
      expect(JSON.stringify(log.mock.calls)).not.toContain("customer@example.invalid");
      expect(mocks.enqueue).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it.each([{}, { order_nsu: "MJ-000001" }, { invoice_slug: "fatura-1", order_nsu: "MJ-000001", transaction_nsu: null }])
  ("rejects incomplete notice %j before checking or confirming payment", async body => {
    const response = await POST(new Request("https://example.invalid/webhook", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.paymentCheck).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without leaking parser input", async () => {
    const response = await POST(new Request("https://example.invalid/webhook", { method: "POST", body: "{ private-fixture" }));
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("private-fixture");
    expect(mocks.paymentCheck).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["invoice", "transaction"])("a false %s reference conflicts before any provider request", async reference => {
    if (reference === "invoice") mocks.attempt.provider_checkout_id = "other-invoice";
    if (reference === "transaction") mocks.attempt.transaction_nsu = "other-transaction";
    expect((await POST(webhookRequest())).status).toBe(409);
    expect(mocks.paymentCheck).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("a false order reference cannot confirm an unknown attempt", async () => {
    const response = await POST(new Request("https://example.invalid/webhook", { method: "POST",
      body: JSON.stringify({ invoice_slug: "fatura-1", transaction_nsu: "transacao-1", order_nsu: "unknown-order", status: "paid", amount: 99000 }) }));
    expect(response.status).toBe(404);
    expect(mocks.paymentCheck).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("ecommerce_confirm_payment", expect.any(Object));
  });

  it("a paid replay is a non-cacheable no-op with no provider request", async () => {
    mocks.attempt.status = "paid";
    const response = await POST(webhookRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: "already_paid" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.paymentCheck).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
