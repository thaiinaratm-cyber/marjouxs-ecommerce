import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkInfinitePayPayment,
  createInfinitePayCheckout,
  getProviderCheckoutId
} from "@/lib/checkout/infinitepay";

describe("InfinitePay client", () => {
  beforeEach(() => {
    process.env.INFINITEPAY_HANDLE = "marjouxsjoias";
    process.env.INFINITEPAY_BASE_URL = "https://api.checkout.infinitepay.io";
  });

  it("extrai o identificador do link oficial", () => {
    expect(
      getProviderCheckoutId("https://checkout.infinitepay.com.br/marjouxsjoias?lenc=fatura-123")
    ).toBe("fatura-123");
    expect(getProviderCheckoutId("https://checkout.infinitepay.com.br/fatura-456")).toBe(
      "fatura-456"
    );
  });

  it("cria link com itens em centavos e dados oficiais", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          url: "https://checkout.infinitepay.com.br/marjouxsjoias?lenc=fatura-123"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await createInfinitePayCheckout(
      {
        orderNsu: "MJ-000001",
        redirectUrl: "https://marjouxsjoias.com.br/pedido/confirmacao?token=test",
        webhookUrl: "https://marjouxsjoias.com.br/api/payments/infinitepay/webhook",
        items: [{ quantity: 1, price: 99000, description: "Anel Ouro 18k" }],
        customer: {
          name: "Cliente",
          email: "cliente@example.com",
          phoneNumber: "+5511999999999"
        }
      },
      fetchMock as unknown as typeof fetch
    );

    expect(result.providerCheckoutId).toBe("fatura-123");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody).toMatchObject({
      handle: "marjouxsjoias",
      order_nsu: "MJ-000001",
      items: [{ quantity: 1, price: 99000, description: "Anel Ouro 18k" }]
    });
  });

  it("aceita paid_amount diferente do valor esperado quando positivo", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          success: true,
          paid: true,
          amount: 150000,
          paid_amount: 151200,
          installments: 3,
          capture_method: "credit_card"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await checkInfinitePayPayment(
      { orderNsu: "MJ-000001", transactionNsu: "tx-1", invoiceSlug: "fatura-1" },
      fetchMock as unknown as typeof fetch
    );

    expect(result).toMatchObject({ amount: 150000, paid_amount: 151200, paid: true });
  });
});
