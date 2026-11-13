import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/checkout/postal-code-lookup", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/checkout/postal-code-lookup")>(),
  lookupPostalCode: vi.fn(async (postalCode: string) => ({ postalCode, city: "São Paulo", state: "SP", street: "", neighborhood: "" }))
}));
import {
  buildShipmentPayload,
  createShippingServiceDiagnostics,
  parseShippingOptions,
  quoteShipping
} from "@/lib/checkout/shipping";

const configuration = {
  baseUrl: "https://sandbox.melhorenvio.com.br",
  userAgent: "Marjouxs Teste (marjouxsgold@gmail.com)",
  allowedServiceIds: ["1", "2"],
  originZip: "07400610",
  package: {
    weightKg: 0.07,
    lengthCm: 16,
    widthCm: 11,
    heightCm: 3
  }
};

describe("Melhor Envio shipping", () => {
  beforeEach(() => {
    vi.stubEnv("MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("envia um único pacote real de 16 x 11 x 3 cm e peso total de 70 g", () => {
    const payload = buildShipmentPayload("01001000", 450000, configuration);

    expect(payload.products).toHaveLength(1);
    expect(payload.products[0]).toMatchObject({
      weight: 0.07,
      width: 11,
      height: 3,
      length: 16,
      insurance_value: 4500,
      quantity: 1
    });
    expect(payload.services).toBe("1,2");
    expect(payload.products[0].weight).toBe(70 / 1000);
    expect(payload.options).toEqual({ receipt: false, own_hand: false });
    expect(payload.from).toEqual({ postal_code: "07400610" });
    expect(payload.to).toEqual({ postal_code: "01001000" });
  });

  it.each([16000, 1185960])("preserva valor declarado integral e uma embalagem para subtotal %i", (subtotalCents) => {
    const payload = buildShipmentPayload("07400805", subtotalCents, configuration);
    expect(payload.products).toEqual([{ id: "marjouxs-package", length: 16, width: 11, height: 3,
      weight: 0.07, quantity: 1, insurance_value: subtotalCents / 100 }]);
    for (const incorrectWeight of [0.7, 7, 70]) expect(payload.products[0].weight).not.toBe(incorrectWeight);
  });

  it("mantém somente serviços autorizados e usa os campos customizados", () => {
    const options = parseShippingOptions(
      [
        {
          id: 1,
          name: "PAC",
          custom_price: "27.45",
          custom_delivery_time: 5,
          company: { name: "Correios" }
        },
        {
          id: 9,
          name: "Não autorizado",
          custom_price: "10.00",
          custom_delivery_time: 1,
          company: { name: "Outra" }
        },
        {
          id: 2,
          name: "SEDEX",
          error: "Serviço indisponível",
          company: { name: "Correios" }
        }
      ],
      configuration.allowedServiceIds,
      new Date("2026-09-11T12:00:00.000Z")
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      serviceId: "1",
      serviceName: "PAC",
      carrierName: "Correios",
      priceCents: 2745,
      deliveryTimeDays: 5,
      quotedAt: "2026-09-11T12:00:00.000Z"
    });
    expect(options[0].shippingQuoteId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("trata erros de cobertura por serviço como lista vazia", () => {
    const options = parseShippingOptions(
      [
        {
          id: 1,
          name: "PAC",
          company: { name: "Correios" },
          error: "Transportadora não atende este trecho."
        },
        {
          id: 2,
          name: "SEDEX",
          company: { name: "Correios" },
          error: "Serviço indisponível para o CEP."
        }
      ],
      configuration.allowedServiceIds
    );

    expect(options).toEqual([]);
  });

  it("limita o diagnóstico aos campos seguros autorizados", () => {
    const diagnostics = createShippingServiceDiagnostics([
      {
        id: 1,
        name: "PAC",
        price: "27.45",
        custom_price: "25.00",
        delivery_time: 6,
        custom_delivery_time: 5,
        company: { name: "Correios", token: "carrier-secret" },
        error: null,
        access_token: "oauth-secret",
        to: { postal_code: "01001000" }
      }
    ]);

    expect(diagnostics).toEqual([
      {
        service_id: 1,
        service_name: "PAC",
        carrier_name: "Correios",
        price: "27.45",
        delivery_time: 6,
        custom_delivery_time: 5,
        error: null
      }
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("oauth-secret");
    expect(JSON.stringify(diagnostics)).not.toContain("01001000");
    expect(JSON.stringify(diagnostics)).not.toContain("carrier-secret");
  });

  it("obtém o token OAuth no servidor antes de cotar o frete", async () => {
    const fetchImplementation = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: "PAC",
            custom_price: "27.45",
            custom_delivery_time: 5,
            company: { name: "Correios" }
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const getAccessToken = vi.fn().mockResolvedValue("oauth-access-token");

    await quoteShipping("01001000", 450000, {
      configuration,
      fetchImplementation: fetchImplementation as typeof fetch,
      getAccessToken
    });

    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer oauth-access-token" })
      })
    );
  });

  it("omite o filtro enviado ao provedor somente no modo diagnóstico", async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await quoteShipping("01001000", 450000, {
      configuration,
      fetchImplementation: fetchImplementation as typeof fetch,
      getAccessToken: async () => "oauth-access-token",
      requestAllServicesForDiagnostics: true
    });

    const requestBody = JSON.parse(fetchImplementation.mock.calls[0][1]?.body as string);
    expect(requestBody).not.toHaveProperty("services");
    expect(configuration.allowedServiceIds).toEqual(["1", "2"]);
  });

  it("classifica 401 do provedor como falha OAuth de integração", async () => {
    const fetchImplementation = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Unauthenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(
      quoteShipping("01001000", 450000, {
        configuration,
        fetchImplementation: fetchImplementation as typeof fetch,
        getAccessToken: async () => "rejected-token"
      })
    ).rejects.toMatchObject({ code: "melhor_envio_oauth_invalid", status: 503 });
  });

  const service = { id: "1", name: "PAC", company: { name: "Correios" }, price: "19.90", delivery_time: 4 };

  const filteredService = {
    id: 2, name: "SEDEX", company: { name: "Correios" },
    price: "9.94", custom_price: "9.94", delivery_time: 2, custom_delivery_time: 2
  };

  it.each([2, "2", " 2 "])("aceita a resposta real services=2 com id %s em objeto ou array", (id) => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    for (const response of [{ ...filteredService, id }, [{ ...filteredService, id }]]) {
      expect(parseShippingOptions(response, ["2"], now)).toEqual([expect.objectContaining({
        serviceId: "2", serviceName: "SEDEX", carrierName: "Correios", priceCents: 994, deliveryTimeDays: 2,
        quotedAt: now.toISOString()
      })]);
    }
  });

  it("objeto único não contorna a allowlist nem substitui preço/prazo customizado inválido", () => {
    expect(parseShippingOptions(filteredService, ["1"])).toEqual([]);
    expect(parseShippingOptions({ ...filteredService, custom_price: "10.25", custom_delivery_time: "3" }, ["2"])[0])
      .toMatchObject({ priceCents: 1025, deliveryTimeDays: 3 });
    for (const invalid of [{ custom_price: "invalid" }, { custom_delivery_time: "invalid" }]) {
      expect(() => parseShippingOptions({ ...filteredService, ...invalid }, ["2"]))
        .toThrow(expect.objectContaining({ code: "invalid_shipping_response", status: 502 }));
    }
  });

  it.each(["id", "name", "company", "price", "delivery_time"])("campo obrigatório ausente %s gera erro sanitizado em objeto e array", (field) => {
    const incomplete: Record<string, unknown> = { id: 2, name: "SEDEX", company: { name: "Correios" }, price: "9.94", delivery_time: 2 };
    delete incomplete[field];
    for (const response of [incomplete, [incomplete]]) {
      expect(() => parseShippingOptions(response, ["2"]))
        .toThrow(expect.objectContaining({ message: "A resposta do Melhor Envio é inválida.", code: "invalid_shipping_response", status: 502 }));
    }
  });

  it.each([null, false, 2, "SEDEX", {}, { error: "private provider detail" }, { data: [filteredService] },
    { ...filteredService, id: "not-a-service" }])("rejeita corpo não reconhecido sem procurar cotações arbitrariamente: %j", (body) => {
    expect(() => parseShippingOptions(body, ["2"]))
      .toThrow(expect.objectContaining({ message: "A resposta do Melhor Envio é inválida.", code: "invalid_shipping_response" }));
  });

  it("preserva válidos em array parcial e trata erro individual isolado sem falha OAuth", () => {
    const unavailable = { id: 1, name: "PAC", company: { name: "Correios" }, error: "Sem cobertura" };
    expect(parseShippingOptions([null, {}, { ...filteredService, company: null }, unavailable, filteredService], ["1", "2"]))
      .toEqual([expect.objectContaining({ serviceId: "2", priceCents: 994 })]);
    expect(parseShippingOptions(unavailable, ["1"])).toEqual([]);
    expect(parseShippingOptions({ id: 2, error: "Sem cobertura" }, ["2"])).toEqual([]);
  });

  it("diagnóstico aceita objeto único com a mesma projeção segura do array", () => {
    const response = { ...filteredService, name: "SEDEX private-token", access_token: "private-token",
      address: "must-not-be-logged", company: { name: "Correios", token: "private-token" } };
    const diagnostics = createShippingServiceDiagnostics(response, ["private-token"]);
    expect(diagnostics).toEqual(createShippingServiceDiagnostics([response], ["private-token"]));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ service_id: 2, service_name: "SEDEX [redacted]", carrier_name: "Correios", price: "9.94" });
    expect(JSON.stringify(diagnostics)).not.toContain("private-token");
    expect(JSON.stringify(diagnostics)).not.toContain("must-not-be-logged");
    expect(createShippingServiceDiagnostics({ error: "private provider detail" })).toEqual([]);
  });

  it("cotação filtrada mantém services=2 no payload e aceita o objeto real", async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(filteredService)));
    const onDiagnostics = vi.fn();
    const result = await quoteShipping("07400805", 10000, {
      configuration: { ...configuration, allowedServiceIds: ["2"] }, fetchImplementation, onDiagnostics,
      getAccessToken: async () => "fixture-access-token"
    });
    expect(result).toEqual([expect.objectContaining({ serviceId: "2", priceCents: 994, deliveryTimeDays: 2 })]);
    expect(JSON.parse(fetchImplementation.mock.calls[0][1]?.body as string)).toMatchObject({ services: "2" });
    expect(onDiagnostics).toHaveBeenCalledWith([expect.objectContaining({ service_id: 2, service_name: "SEDEX", price: "9.94" })]);
  });

  it.each([
    ["19.90", 1990], [19.9, 1990], ["19,90", 1990], ["1.234,56", 123456],
    ["0.19", 19], ["19", 1900], ["0.29", 29]
  ])("normaliza preço %s em %s centavos", (price, cents) => {
    expect(parseShippingOptions([{ ...service, price }], ["1"])[0].priceCents).toBe(cents);
  });

  it.each(["", "NaN", "19 reais", "1.234", "1e3", -1, 0, true, Infinity])("rejeita preço inválido %s sem inventar frete", (price) => {
    expect(parseShippingOptions([{ ...service, price }], ["1"])).toEqual([]);
  });

  it("não ignora customização inválida para oferecer preço/prazo base", () => {
    expect(parseShippingOptions([{ ...service, custom_price: "inválido" }], ["1"])).toEqual([]);
    expect(parseShippingOptions([{ ...service, custom_delivery_time: "inválido" }], ["1"])).toEqual([]);
    expect(parseShippingOptions([{ ...service, custom_price: null, custom_delivery_time: null }], ["1"])[0])
      .toMatchObject({ priceCents: 1990, deliveryTimeDays: 4 });
  });

  it.each([null, undefined, "", "2.5", -1, 1.5, true, Infinity])("não converte prazo inválido %s para zero", (delivery_time) => {
    expect(parseShippingOptions([{ ...service, delivery_time }], ["1"])).toEqual([]);
  });

  it("normaliza IDs e prazo string sem perder respostas parciais válidas", () => {
    const response = [null, false, 42, "error", {}, { ...service, company: null },
      { ...service, id: "2", error: "Sem cobertura" },
      { ...service, id: 1, custom_delivery_time: " 5 " },
      { ...service, id: " 2 ", custom_price: "25.00", custom_delivery_time: 0 },
      { ...service, id: 9 }];
    expect(parseShippingOptions(response, [" 1 ", "2"]).map(({ serviceId, priceCents, deliveryTimeDays }) =>
      ({ serviceId, priceCents, deliveryTimeDays }))).toEqual([
      { serviceId: "1", priceCents: 1990, deliveryTimeDays: 5 },
      { serviceId: "2", priceCents: 2500, deliveryTimeDays: 0 }
    ]);
    expect(() => createShippingServiceDiagnostics(response)).not.toThrow();
  });

  it.each([
    [400, "shipping_provider_bad_request", 422],
    [401, "melhor_envio_oauth_invalid", 503],
    [403, "melhor_envio_oauth_invalid", 503],
    [404, "shipping_provider_not_found", 502],
    [422, "shipping_provider_validation_error", 422],
    [429, "shipping_provider_rate_limited", 429],
    [500, "shipping_provider_unavailable", 502],
    [503, "shipping_provider_unavailable", 502]
  ])("preserva classificação HTTP %s mesmo com corpo HTML inválido", async (upstream, code, status) => {
    await expect(quoteShipping("01001000", 10000, {
      configuration, getAccessToken: async () => "vault-secret",
      fetchImplementation: vi.fn(async () => new Response("<html>provider failure</html>", { status: upstream }))
    })).rejects.toMatchObject({ code, status });
  });

  it.each(["TimeoutError", "AbortError"])("classifica %s sem propagar mensagem externa", async (name) => {
    const error = new Error("Authorization: Bearer must-not-be-logged");
    error.name = name;
    await expect(quoteShipping("01001000", 10000, {
      configuration, getAccessToken: async () => "vault-secret",
      fetchImplementation: vi.fn().mockRejectedValue(error)
    })).rejects.toMatchObject({ code: "shipping_provider_timeout", status: 504 });
  });

  it("limita a espera da rede a 12 segundos", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const promise = quoteShipping("01001000", 10000, {
      configuration, getAccessToken: async () => "vault-secret",
      fetchImplementation: vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }))
    });
    const rejected = expect(promise).rejects.toMatchObject({ code: "shipping_provider_timeout", status: 504 });
    await vi.waitFor(() => expect(timeout).toHaveBeenCalledWith(12000));
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await rejected;
  });

  it("classifica erro de rede sem expor a mensagem original", async () => {
    await expect(quoteShipping("01001000", 10000, {
      configuration, getAccessToken: async () => "vault-secret",
      fetchImplementation: vi.fn().mockRejectedValue(new TypeError("network secret"))
    })).rejects.toMatchObject({ code: "shipping_provider_unreachable", status: 502 });
  });

  it.each(["not json", JSON.stringify({ error: "invalid shape" })])("rejeita resposta 200 inválida", async (body) => {
    await expect(quoteShipping("01001000", 10000, {
      configuration, getAccessToken: async () => "vault-secret",
      fetchImplementation: vi.fn(async () => new Response(body, { status: 200 }))
    })).rejects.toMatchObject({ code: "invalid_shipping_response", status: 502 });
  });

  it("mantém lista vazia válida e diagnóstico não interfere na cotação", async () => {
    await expect(quoteShipping("01001000", 10000, {
      configuration, getAccessToken: async () => "vault-secret",
      fetchImplementation: vi.fn(async () => new Response("[]")),
      onDiagnostics: () => { throw new Error("diagnostic failure"); }
    })).resolves.toEqual([]);
  });

  it.each(["/api/v2/me/shipment/cart", "/api/v2/me/shipment/checkout", "/api/v2/me/shipment/generate",
    "/api/v2/me/shipment/print", "/api/v2/me/shipment/cancel", "/purchases", "?path=labels"])("bloqueia base com endpoint extra %s antes do token ou rede", async (suffix) => {
    const getAccessToken = vi.fn();
    const fetchImplementation = vi.fn();
    await expect(quoteShipping("07400805", 50000, {
      configuration: { ...configuration, baseUrl: `${configuration.baseUrl}${suffix}` },
      getAccessToken, fetchImplementation
    })).rejects.toMatchObject({ code: "shipping_endpoint_invalid" });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each(["https://sandbox.melhorenvio.com.br", "https://melhorenvio.com.br"])("%s só usa cálculo e nunca segue redirects", async (baseUrl) => {
    const fetchImplementation = vi.fn(async () => new Response("[]"));
    await quoteShipping("07400805", 50000, { configuration: { ...configuration, baseUrl }, fetchImplementation,
      getAccessToken: async () => "fixture-token" });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith(`${baseUrl}/api/v2/me/shipment/calculate`,
      expect.objectContaining({ method: "POST", redirect: "error", cache: "no-store" }));
  });
});
