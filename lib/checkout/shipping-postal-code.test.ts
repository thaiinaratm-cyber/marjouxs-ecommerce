import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createLink: vi.fn() }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/checkout/infinitepay", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/checkout/infinitepay")>(),
  createInfinitePayCheckout: mocks.createLink
}));
import * as postalLookup from "@/lib/checkout/postal-code-lookup";
import { POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";
import { quoteShipping } from "@/lib/checkout/shipping";
import { POST as quoteRoute } from "@/app/api/shipping/quote/route";
import { createCheckout } from "@/lib/checkout/create-checkout";
import { POST as createRoute } from "@/app/api/payments/infinitepay/create/route";

const configuration = {
  baseUrl: "https://sandbox.melhorenvio.com.br", userAgent: "Marjouxs QA", allowedServiceIds: ["2"], originZip: "07400610",
  package: { weightKg: 0.3, lengthCm: 16, widthCm: 12, heightCm: 6 }
};
const service = { id: 2, name: "SEDEX", company: { name: "Correios" }, price: "9.94", delivery_time: 2 };
const existingCep = { cep: "07400-805", localidade: "Arujá", uf: "SP" };
const items = [{ productId: "brinco-ponto-de-luz", productSlug: "brinco-ponto-de-luz", quantity: 1 }];

describe("CEP guard before Melhor Envio and order creation", () => {
  const cepFetch = vi.fn();
  const shippingFetch = vi.fn();
  const getAccessToken = vi.fn();
  beforeEach(() => {
    vi.stubEnv("MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN", "");
    vi.stubEnv("MELHOR_ENVIO_BASE_URL", configuration.baseUrl);
    vi.stubEnv("MELHOR_ENVIO_USER_AGENT", configuration.userAgent);
    vi.stubEnv("MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS", "2");
    vi.stubEnv("CHECKOUT_CATALOG_SOURCE", "static");
    cepFetch.mockReset().mockResolvedValue(new Response(JSON.stringify(existingCep)));
    shippingFetch.mockReset().mockImplementation(async () => new Response(JSON.stringify([service])));
    getAccessToken.mockReset().mockResolvedValue("fixture-token");
    vi.spyOn(postalLookup, "lookupPostalCode").mockImplementation(postalLookup.createPostalCodeLookup({ fetchImplementation: cepFetch }));
    mocks.rpc.mockReset();
    mocks.createLink.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const options = { configuration, fetchImplementation: shippingFetch, getAccessToken };

  const routeRequest = () => new Request("http://localhost/api/shipping/quote", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postalCode: "07400805", items })
  });
  it("timeout retorna mensagem amigável sem detalhes externos", async () => {
    vi.stubEnv("MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN", "fixture-local-token");
    shippingFetch.mockRejectedValue(new DOMException("private timeout detail", "TimeoutError"));
    vi.stubGlobal("fetch", shippingFetch);
    const response = await quoteRoute(routeRequest());
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ code: "shipping_provider_timeout",
      error: "Não foi possível calcular o frete agora. Tente novamente em instantes." });
  });
  it("erro inesperado não serializa detalhes em resposta ou logs", async () => {
    vi.mocked(postalLookup.lookupPostalCode).mockRejectedValue(new Error("fixture-private-secret"));
    const response = await quoteRoute(routeRequest());
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("fixture-private-secret");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("fixture-private-secret");
    expect(shippingFetch).not.toHaveBeenCalled();
  });
  it("configuração ausente não expõe nomes de env ao cliente", async () => {
    vi.stubEnv("MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS", "");
    const response = await quoteRoute(routeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "shipping_unavailable",
      error: "Não foi possível calcular o frete agora. Tente novamente em instantes." });
    expect(shippingFetch).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500])("API de cotação sanitiza falha HTTP %s sem expor token ou provider", async (status) => {
    vi.stubEnv("MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN", "fixture-local-token");
    shippingFetch.mockResolvedValue(new Response("private provider detail fixture-local-token", { status }));
    vi.stubGlobal("fetch", shippingFetch);
    const response = await quoteRoute(new Request("http://localhost/api/shipping/quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postalCode: "07400805", items })
    }));
    const body = await response.json();
    expect(body.error).toBe("Não foi possível calcular o frete agora. Tente novamente em instantes.");
    expect(JSON.stringify(body)).not.toContain("fixture-local-token");
    expect(JSON.stringify(body)).not.toContain("private provider detail");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["07400805", "07400-805"])("%s valida existência antes do token/cálculo", async (cep) => {
    const result = await quoteShipping(cep, 10000, options);
    expect(result).toEqual([expect.objectContaining({ serviceId: "2", priceCents: 994, deliveryTimeDays: 2 })]);
    expect(cepFetch.mock.invocationCallOrder[0]).toBeLessThan(getAccessToken.mock.invocationCallOrder[0]);
    expect(getAccessToken.mock.invocationCallOrder[0]).toBeLessThan(shippingFetch.mock.invocationCallOrder[0]);
    expect(JSON.parse(shippingFetch.mock.calls[0][1].body).to.postal_code).toBe("07400805");
  });

  it.each(["07400", "abcdefgh", "07400-80x", "07400805x", ""])("%s não acessa nenhum serviço externo", async (cep) => {
    await expect(quoteShipping(cep, 10000, options)).rejects.toMatchObject({ code: "invalid_postal_code", status: 400 });
    expect(cepFetch).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(shippingFetch).not.toHaveBeenCalled();
  });

  it("99999999 não obtém token nem consulta Melhor Envio", async () => {
    cepFetch.mockResolvedValue(new Response(JSON.stringify({ erro: true })));
    await expect(quoteShipping("99999999", 10000, options)).rejects.toMatchObject({ code: "postal_code_not_found", message: POSTAL_CODE_MESSAGES.notFound });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(shippingFetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["timeout", "network", "5xx", "json"])("falha %s do ViaCEP impede cotação sem afirmar inexistência", async (kind) => {
    if (kind === "5xx") cepFetch.mockResolvedValue(new Response("offline", { status: 503 }));
    else if (kind === "json") cepFetch.mockResolvedValue(new Response("invalid json"));
    else cepFetch.mockRejectedValue(kind === "timeout" ? new DOMException("timeout", "TimeoutError") : new Error("network"));
    await expect(quoteShipping("07400805", 10000, options)).rejects.toMatchObject({ code: "postal_code_service_unavailable", message: POSTAL_CODE_MESSAGES.unavailable });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(shippingFetch).not.toHaveBeenCalled();
  });

  it("a rota retorna 404 sem opções mesmo com carrinho válido", async () => {
    cepFetch.mockResolvedValue(new Response(JSON.stringify({ erro: true })));
    vi.stubGlobal("fetch", shippingFetch);
    const response = await quoteRoute(new Request("http://localhost/api/shipping/quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postalCode: "99999999", items })
    }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: POSTAL_CODE_MESSAGES.notFound, code: "postal_code_not_found" });
    expect(shippingFetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([true, false])("endereço manual não contorna verificação no checkout (inexistente=%s)", async (notFound) => {
    cepFetch.mockResolvedValue(notFound ? new Response('{"erro":true}') : new Response("offline", { status: 503 }));
    vi.stubGlobal("fetch", shippingFetch);
    await expect(createCheckout({
      requestId: "00000000-0000-4000-8000-000000000001",
      items: items.map((item) => ({ ...item, customization: null })),
      customer: { name: "Fixture", phone: "11999999999", email: "fixture@example.com", cpf: "" },
      delivery: { method: "shipping", address: {
        postalCode: notFound ? "99999999" : "07400805", street: "Rua preenchida manualmente", number: "1", complement: "",
        neighborhood: "Centro", city: "Arujá", state: "SP", serviceId: "2", shippingQuoteId: "00000000-0000-4000-8000-000000000002"
      } }
    }, "http://localhost")).rejects.toMatchObject({ code: notFound ? "postal_code_not_found" : "postal_code_service_unavailable" });
    expect(shippingFetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it.each([true, false])("a API final também preserva o código e a mensagem de CEP (inexistente=%s)", async (notFound) => {
    cepFetch.mockResolvedValue(notFound ? new Response('{"erro":true}') : new Response("offline", { status: 503 }));
    vi.stubGlobal("fetch", shippingFetch);
    const response = await createRoute(new Request("http://localhost/api/payments/infinitepay/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "00000000-0000-4000-8000-000000000001",
        items: items.map((item) => ({ ...item, customization: null })),
        customer: { name: "Fixture", phone: "11999999999", email: "fixture@example.com", cpf: "" },
        delivery: { method: "shipping", address: {
          postalCode: notFound ? "99999999" : "07400805", street: "Rua manual", number: "1", complement: "",
          neighborhood: "Centro", city: "Arujá", state: "SP", serviceId: "2", shippingQuoteId: "00000000-0000-4000-8000-000000000002"
        } }
      })
    }));
    expect(response.status).toBe(notFound ? 404 : 503);
    expect(await response.json()).toEqual({ code: notFound ? "postal_code_not_found" : "postal_code_service_unavailable",
      error: notFound ? POSTAL_CODE_MESSAGES.notFound : POSTAL_CODE_MESSAGES.unavailable });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
    expect(shippingFetch).not.toHaveBeenCalled();
  });
});
