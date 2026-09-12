import { randomUUID } from "node:crypto";
import { getShippingConfiguration } from "@/lib/checkout/config";
import { MelhorEnvioOAuthError } from "@/lib/checkout/melhor-envio-oauth";
import { getValidMelhorEnvioAccessToken } from "@/lib/checkout/melhor-envio-token";
import type { ShippingQuoteOption } from "@/types/checkout";

type ShippingConfiguration = ReturnType<typeof getShippingConfiguration>;
type FetchImplementation = typeof fetch;
type ShippingDiagnosticValue = string | number | null;

export type ShippingServiceDiagnostic = {
  service_id: ShippingDiagnosticValue;
  service_name: ShippingDiagnosticValue;
  carrier_name: ShippingDiagnosticValue;
  price: ShippingDiagnosticValue;
  delivery_time: ShippingDiagnosticValue;
  custom_delivery_time: ShippingDiagnosticValue;
  error: ShippingDiagnosticValue;
};

type MelhorEnvioResponse = {
  id?: string | number;
  name?: string;
  price?: string | number;
  delivery_time?: string | number;
  custom_price?: string | number;
  custom_delivery_time?: string | number;
  company?: { name?: string };
  error?: string;
};

function diagnosticValue(value: unknown): ShippingDiagnosticValue {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value.slice(0, 300);
  return null;
}

export function createShippingServiceDiagnostics(response: unknown): ShippingServiceDiagnostic[] {
  if (!Array.isArray(response)) return [];

  return response.map((rawQuote) => {
    const quote = rawQuote as MelhorEnvioResponse;
    return {
      service_id: diagnosticValue(quote.id),
      service_name: diagnosticValue(quote.name),
      carrier_name: diagnosticValue(quote.company?.name),
      price: diagnosticValue(quote.price),
      delivery_time: diagnosticValue(quote.delivery_time),
      custom_delivery_time: diagnosticValue(quote.custom_delivery_time),
      error: diagnosticValue(quote.error)
    };
  });
}

export class ShippingProviderError extends Error {
  constructor(message: string, readonly code: string, readonly status = 502) {
    super(message);
    this.name = "ShippingProviderError";
  }
}

export function buildShipmentPayload(
  destinationZip: string,
  subtotalCents: number,
  configuration: ShippingConfiguration
) {
  const shipment = configuration.package;
  return {
    from: { postal_code: configuration.originZip },
    to: { postal_code: destinationZip },
    products: [
      {
        id: "marjouxs-package",
        width: shipment.widthCm,
        height: shipment.heightCm,
        length: shipment.lengthCm,
        weight: shipment.weightKg,
        insurance_value: Number((subtotalCents / 100).toFixed(2)),
        quantity: 1
      }
    ],
    options: {
      receipt: false,
      own_hand: false
    },
    services: configuration.allowedServiceIds.join(",")
  };
}

export function parseShippingOptions(
  response: unknown,
  allowedServiceIds: string[],
  now = new Date()
): ShippingQuoteOption[] {
  if (!Array.isArray(response)) {
    throw new ShippingProviderError("A resposta do Melhor Envio é inválida.", "invalid_shipping_response");
  }

  const allowedIds = new Set(allowedServiceIds);
  return response.flatMap((rawQuote) => {
    const quote = rawQuote as MelhorEnvioResponse;
    const serviceId = quote.id === undefined ? "" : String(quote.id);
    const price = Number(quote.custom_price);
    const deliveryTimeDays = Number(quote.custom_delivery_time);

    if (
      quote.error ||
      !allowedIds.has(serviceId) ||
      !quote.name ||
      !quote.company?.name ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(deliveryTimeDays) ||
      deliveryTimeDays < 0
    ) {
      return [];
    }

    return [
      {
        shippingQuoteId: randomUUID(),
        serviceId,
        serviceName: quote.name,
        carrierName: quote.company.name,
        priceCents: Math.round(price * 100),
        deliveryTimeDays,
        quotedAt: now.toISOString()
      }
    ];
  });
}

export async function quoteShipping(
  destinationZip: string,
  subtotalCents: number,
  options: {
    configuration?: ShippingConfiguration;
    fetchImplementation?: FetchImplementation;
    getAccessToken?: () => Promise<string>;
    onDiagnostics?: (services: ShippingServiceDiagnostic[]) => void;
    requestAllServicesForDiagnostics?: boolean;
  } = {}
) {
  const configuration = options.configuration ?? getShippingConfiguration();
  const fetchImplementation = options.fetchImplementation ?? fetch;
  let accessToken: string;
  try {
    accessToken = await (options.getAccessToken ?? getValidMelhorEnvioAccessToken)();
  } catch (error) {
    if (error instanceof MelhorEnvioOAuthError) {
      throw new ShippingProviderError(error.message, error.code, error.status);
    }
    throw error;
  }
  const shipmentPayload = { ...buildShipmentPayload(destinationZip, subtotalCents, configuration) };
  if (options.requestAllServicesForDiagnostics) {
    Reflect.deleteProperty(shipmentPayload, "services");
  }
  const response = await fetchImplementation(`${configuration.baseUrl}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": configuration.userAgent
    },
    body: JSON.stringify(shipmentPayload),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store"
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShippingProviderError("O Melhor Envio retornou uma resposta inválida.", "invalid_shipping_response");
  }

  options.onDiagnostics?.(createShippingServiceDiagnostics(body));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ShippingProviderError(
        "A autenticação da integração de frete foi recusada pelo Melhor Envio.",
        "melhor_envio_oauth_invalid",
        503
      );
    }
    throw new ShippingProviderError(
      "Não foi possível calcular o frete neste momento.",
      "shipping_provider_error",
      response.status >= 400 && response.status < 500 ? 422 : 502
    );
  }

  return parseShippingOptions(body, configuration.allowedServiceIds);
}
