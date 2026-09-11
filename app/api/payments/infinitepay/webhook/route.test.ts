import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  paymentCheck: vi.fn(),
  rpc: vi.fn(),
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
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.attempt, error: null })
        })
      })
    }),
    rpc: mocks.rpc
  })
}));

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
    mocks.confirmationCode = "paid";
    mocks.attempt.requested_amount_cents = 99000;
    mocks.paymentCheck.mockResolvedValue({
      success: true,
      paid: true,
      amount: 99000,
      paid_amount: 99500,
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
    expect(mocks.rpc).toHaveBeenCalledWith(
      "ecommerce_confirm_payment",
      expect.objectContaining({
        p_payment_verified: true,
        p_check_success: true,
        p_check_paid: true,
        p_amount_cents: 99000,
        p_paid_amount_cents: 99500
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
  });
});
