import { describe, expect, it, vi } from "vitest";
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
    weightKg: 0.3,
    lengthCm: 16,
    widthCm: 12,
    heightCm: 6
  }
};

describe("Melhor Envio shipping", () => {
  it("envia um único pacote provisório com peso total de 300 g", () => {
    const payload = buildShipmentPayload("01001000", 450000, configuration);

    expect(payload.products).toHaveLength(1);
    expect(payload.products[0]).toMatchObject({
      weight: 0.3,
      width: 12,
      height: 6,
      length: 16,
      insurance_value: 4500,
      quantity: 1
    });
    expect(payload.services).toBe("1,2");
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
});
