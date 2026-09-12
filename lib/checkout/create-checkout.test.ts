import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createProviderCheckout: vi.fn(),
  quoteShipping: vi.fn()
}));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc })
}));

vi.mock("@/lib/checkout/shipping", () => ({
  quoteShipping: mocks.quoteShipping
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
    createInfinitePayCheckout: mocks.createProviderCheckout
  };
});

import { createCheckout } from "@/lib/checkout/create-checkout";

const request = {
  requestId: "3f2a90a7-712f-4bc7-ac3a-536227af01a0",
  items: [
    {
      productId: "brinco-ponto-de-luz",
      productSlug: "brinco-ponto-de-luz",
      quantity: 1,
      customization: null
    }
  ],
  customer: {
    name: "Cliente Teste",
    phone: "11999999999",
    email: "cliente@example.com",
    cpf: ""
  },
  delivery: { method: "pickup" as const }
};

describe("createCheckout", () => {
  beforeEach(() => {
    mocks.createProviderCheckout.mockResolvedValue({
      checkoutUrl: "https://checkout.infinitepay.com.br/marjouxs?lenc=fatura-1",
      providerCheckoutId: "fatura-1"
    });
    mocks.rpc.mockImplementation(async (operation: string) => {
      if (operation === "ecommerce_create_checkout") {
        return {
          data: [
            {
              result_order_id: "00000000-0000-4000-8000-000000000001",
              result_order_number: "MJ-000001",
              result_public_token: "00000000-0000-4000-8000-000000000002",
              result_payment_attempt_id: "00000000-0000-4000-8000-000000000003",
              result_order_nsu: "MJ-000001",
              result_total_cents: 17990,
              result_attempt_status: "creating",
              result_checkout_url: null
            }
          ],
          error: null
        };
      }
      if (operation === "ecommerce_set_checkout_link") {
        return {
          data: [
            {
              result_code: "registered",
              result_attempt_id: "00000000-0000-4000-8000-000000000003",
              result_attempt_status: "pending"
            }
          ],
          error: null
        };
      }
      return { data: true, error: null };
    });
  });

  it("recalcula o preço no servidor e não aceita preço no payload do navegador", async () => {
    const result = await createCheckout(request, "https://marjouxsjoias.com.br");

    expect(result.totalCents).toBe(17990);
    const createCall = mocks.rpc.mock.calls.find(([operation]) => operation === "ecommerce_create_checkout");
    expect(createCall?.[1].p_order.subtotal_cents).toBe(17990);
    expect(createCall?.[1].p_order.customer_cpf).toBeNull();
    expect(createCall?.[1].p_items[0].unit_price_cents).toBe(17990);
  });

  it("classifica a constraint da criação sem chamar a InfinitePay", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23514",
        message:
          'new row for relation "ecommerce_orders" violates check constraint "ecommerce_orders_delivery_data_ck"',
        details: "Failing row contains (cliente@example.com, 11999999999)."
      }
    });

    await expect(createCheckout(request, "https://marjouxsjoias.com.br")).rejects.toMatchObject({
      publicCode: "checkout_order_creation_error",
      status: 500,
      diagnostic: {
        stage: "ecommerce_orders",
        error_code: "check_violation",
        postgres_code: "23514",
        constraint_name: "ecommerce_orders_delivery_data_ck",
        rpc_name: "ecommerce_create_checkout",
        order_nsu: null,
        http_status: 500
      }
    });
    expect(mocks.createProviderCheckout).not.toHaveBeenCalled();
  });

  it("compartilha a criação externa quando a mesma tentativa chega em paralelo", async () => {
    let releaseProvider!: () => void;
    mocks.createProviderCheckout.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseProvider = () =>
            resolve({
              checkoutUrl: "https://checkout.infinitepay.com.br/marjouxs?lenc=fatura-1",
              providerCheckoutId: "fatura-1"
            });
        })
    );

    const first = createCheckout(request, "https://marjouxsjoias.com.br");
    const second = createCheckout(request, "https://marjouxsjoias.com.br");
    await vi.waitFor(() => expect(mocks.createProviderCheckout).toHaveBeenCalledTimes(1));
    releaseProvider();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.checkoutUrl).toBe(secondResult.checkoutUrl);
    expect(mocks.createProviderCheckout).toHaveBeenCalledTimes(1);
  });
});
