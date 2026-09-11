import { describe, expect, it, vi } from "vitest";
import { buildShipmentPayload, parseShippingOptions, quoteShipping } from "@/lib/checkout/shipping";

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
});
