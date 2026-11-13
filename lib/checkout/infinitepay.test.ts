import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkInfinitePayPayment,
  createInfinitePayCheckout,
  prepareInfinitePayCheckout,
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

  it("parser preserva valores distintos; aprovação financeira é uma validação separada", async () => {
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

  it.each([
    {amount:true},{amount:"150000"},{amount:150000.5},{amount:Number.MAX_SAFE_INTEGER+1},
    {paid_amount:true},{paid_amount:"151200"},{paid_amount:151200.5},{paid_amount:Number.MAX_SAFE_INTEGER+1},
    {capture_method:"unknown"},{installments:1.5}
  ])("payment_check rejects malformed numeric/method fields %j", async fields => {
    const http = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success:true,paid:true,amount:150000,paid_amount:150000,installments:1,capture_method:"pix",...fields
    })));
    await expect(checkInfinitePayPayment({orderNsu:"MJ-000001",transactionNsu:"tx-1",invoiceSlug:"fatura-1"},http))
      .rejects.toMatchObject({code:"invalid_payment_check"});
    expect(http).toHaveBeenCalledTimes(1);
  });

  const linkInput = {
    orderNsu: "MJ-000001", redirectUrl: "https://example.invalid/confirmation",
    webhookUrl: "https://example.invalid/webhook",
    items: [{ quantity: 1, price: 16000, description: "Fixture" }, { quantity: 1, price: 994, description: "Frete" }],
    customer: { name: "QA",email: "qa@example.invalid",phoneNumber: "+5511000000000" },
    address: { cep: "07400805",street: "Fixture",number: "1",neighborhood: "Fixture" }
  };

  it.each(["TimeoutError", "AbortError", "Error"])("payment_check sanitizes %s and never retries", async (name) => {
    const failure = new Error("secret-token customer@example.invalid"); failure.name = name;
    const http = vi.fn().mockRejectedValue(failure);
    const error = await checkInfinitePayPayment({ orderNsu: "fixture", transactionNsu: "fixture", invoiceSlug: "fixture" }, http).catch(error => error);
    expect(error).toMatchObject({ code: name === "Error" ? "payment_provider_unavailable" : "payment_provider_timeout", status: 503 });
    expect(error.message).not.toMatch(/secret-token|customer@example/);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each(["not JSON", "{}"])("payment_check malformed body never becomes a payment confirmation", async (body) => {
    const http = vi.fn().mockResolvedValue(new Response(body));
    await expect(checkInfinitePayPayment({ orderNsu: "fixture", transactionNsu: "fixture", invoiceSlug: "fixture" }, http))
      .rejects.toMatchObject({ code: body === "{}" ? "invalid_payment_check" : "invalid_payment_response" });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("prepares without HTTP and preserves the complete commercial payload", async () => {
    const http = vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: "https://example.invalid/link" })));
    const send = prepareInfinitePayCheckout(linkInput,http);
    expect(http).not.toHaveBeenCalled();
    await send();
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0]).toBe("https://api.checkout.infinitepay.io/links");
    expect(JSON.parse(http.mock.calls[0][1].body)).toEqual({
      handle: "marjouxsjoias",order_nsu: linkInput.orderNsu,redirect_url:linkInput.redirectUrl,
      webhook_url:linkInput.webhookUrl,items:linkInput.items,
      customer: { name:"QA",email:"qa@example.invalid",phone_number:"+5511000000000" },address:linkInput.address
    });
  });

  it("configuration failure occurs before any HTTP is possible", () => {
    process.env.INFINITEPAY_BASE_URL = "not a URL";
    const http = vi.fn();
    expect(() => prepareInfinitePayCheckout(linkInput,http)).toThrow();
    expect(http).not.toHaveBeenCalled();
  });

  it.each([400,401,403,422,429])("classifies confirmed HTTP %i rejection without retry", async status => {
    const http = vi.fn().mockResolvedValue(new Response("private body",{ status }));
    await expect(createInfinitePayCheckout(linkInput,http)).rejects.toMatchObject({ outcome:"rejected",code:"payment_provider_error" });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([408,409,500,502,503])("classifies HTTP %i as uncertain without retry", async status => {
    const http = vi.fn().mockResolvedValue(new Response("private body",{ status }));
    await expect(createInfinitePayCheckout(linkInput,http)).rejects.toMatchObject({ outcome:"unknown" });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each(["not JSON", JSON.stringify({url:"http://unsafe.invalid"}), JSON.stringify({})])("invalid successful response remains uncertain", async body => {
    const http = vi.fn().mockResolvedValue(new Response(body));
    await expect(createInfinitePayCheckout(linkInput,http)).rejects.toMatchObject({ outcome:"unknown" });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("network/timeout errors are sanitized and not retried", async () => {
    const http = vi.fn().mockRejectedValue(new Error("secret-token qa@example.invalid"));
    const error = await createInfinitePayCheckout(linkInput,http).catch(error => error);
    expect(error.outcome).toBe("unknown");
    expect(error.message).not.toContain("secret-token");
    expect(error.message).not.toContain("qa@example.invalid");
    expect(http).toHaveBeenCalledTimes(1);
  });
});
