import { randomUUID } from "node:crypto";
import { getShippingConfiguration } from "@/lib/checkout/config";
import { MelhorEnvioOAuthError } from "@/lib/checkout/melhor-envio-oauth";
import { getValidMelhorEnvioAccessToken } from "@/lib/checkout/melhor-envio-token";
import { getLocalMelhorEnvioSandboxAccessToken } from "@/lib/checkout/melhor-envio-local-sandbox";
import { normalizePostalCode, POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";
import { lookupPostalCode, PostalCodeError } from "@/lib/checkout/postal-code-lookup";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shippingResponseEntries(response: unknown): unknown[] | null {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return null;
  const id = typeof response.id === "string" || typeof response.id === "number" ? String(response.id).trim() : "";
  // A filtered calculation returns the service itself, not an envelope or arbitrary error object.
  return /^\d+$/.test(id) ? [response] : null;
}

function diagnosticValue(value: unknown, secrets: string[]): ShippingDiagnosticValue {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    let sanitized = value;
    for (const secret of secrets) {
      if (secret) sanitized = sanitized.split(secret).join("[redacted]");
    }
    return sanitized.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300);
  }
  return null;
}

export function createShippingServiceDiagnostics(response: unknown, secrets: string[] = []): ShippingServiceDiagnostic[] {
  const entries = shippingResponseEntries(response);
  if (!entries) return [];

  return entries.flatMap((quote) => {
    if (!isRecord(quote)) return [];
    return [{
      service_id: diagnosticValue(quote.id, secrets),
      service_name: diagnosticValue(quote.name, secrets),
      carrier_name: diagnosticValue(isRecord(quote.company) ? quote.company.name : null, secrets),
      price: diagnosticValue(quote.price, secrets),
      delivery_time: diagnosticValue(quote.delivery_time, secrets),
      custom_delivery_time: diagnosticValue(quote.custom_delivery_time, secrets),
      // Provider error messages can echo credentials or customer data.
      error: quote.error ? "service_error" : null
    }];
  });
}

function priceInCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let normalized = String(value).trim();
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function deliveryDays(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value.trim()))) return null;
  const days = Number(value);
  return Number.isSafeInteger(days) && days >= 0 ? days : null;
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
  const entries = shippingResponseEntries(response);
  if (!entries) {
    throw new ShippingProviderError("A resposta do Melhor Envio é inválida.", "invalid_shipping_response");
  }

  const singleService = !Array.isArray(response);
  const allowedIds = new Set(allowedServiceIds.map((id) => id.trim()));
  let incompleteResponse = false;
  let recognizedService = false;
  const options = entries.flatMap((quote) => {
    if (!isRecord(quote)) {
      incompleteResponse = true;
      return [];
    }
    const serviceId = typeof quote.id === "string" || typeof quote.id === "number" ? String(quote.id).trim() : "";
    if (quote.error && /^\d+$/.test(serviceId)) {
      recognizedService = true;
      return [];
    }
    const serviceName = typeof quote.name === "string" ? quote.name.trim() : "";
    const carrierName = isRecord(quote.company) && typeof quote.company.name === "string" ? quote.company.name.trim() : "";
    if (!/^\d+$/.test(serviceId) || !serviceName || !carrierName ||
      (!("price" in quote) && !("custom_price" in quote)) ||
      (!("delivery_time" in quote) && !("custom_delivery_time" in quote))) {
      incompleteResponse = true;
      return [];
    }
    recognizedService = true;
    // Do not replace an invalid custom price with a potentially cheaper base price.
    const priceCents = priceInCents(quote.custom_price ?? quote.price);
    const deliveryTimeDays = deliveryDays(quote.custom_delivery_time ?? quote.delivery_time);

    if (
      priceCents === null ||
      deliveryTimeDays === null
    ) {
      if (singleService) {
        throw new ShippingProviderError("A resposta do Melhor Envio é inválida.", "invalid_shipping_response");
      }
      return [];
    }
    if (!allowedIds.has(serviceId)) return [];

    return [
      {
        shippingQuoteId: randomUUID(),
        serviceId,
        serviceName,
        carrierName,
        priceCents,
        deliveryTimeDays,
        quotedAt: now.toISOString()
      }
    ];
  });
  if (incompleteResponse && !recognizedService) {
    throw new ShippingProviderError("A resposta do Melhor Envio é inválida.", "invalid_shipping_response");
  }
  return options;
}

function isTimeout(error: unknown, signal: AbortSignal) {
  return signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name));
}

function transportError(error: unknown, signal: AbortSignal) {
  return isTimeout(error, signal)
    ? new ShippingProviderError("O cálculo de frete demorou mais que o esperado. Tente novamente.", "shipping_provider_timeout", 504)
    : new ShippingProviderError("Não foi possível comunicar com o Melhor Envio. Tente novamente.", "shipping_provider_unreachable", 502);
}

function providerHttpError(status: number, localSandbox: boolean) {
  if (status === 401 || status === 403) {
    return localSandbox
      ? new ShippingProviderError(
          "O token Sandbox local está inválido ou expirado. Configure um novo token local.",
          "melhor_envio_local_sandbox_token_invalid", 503
        )
      : new ShippingProviderError(
          "A autenticação da integração de frete foi recusada pelo Melhor Envio.",
          "melhor_envio_oauth_invalid", 503
        );
  }
  if (status === 429) {
    return new ShippingProviderError("O Melhor Envio recebeu muitas consultas. Aguarde e tente novamente.", "shipping_provider_rate_limited", 429);
  }
  if (status === 400 || status === 422) {
    return new ShippingProviderError("O Melhor Envio não aceitou os dados da cotação. Confira o CEP ou fale com nossa equipe.",
      status === 400 ? "shipping_provider_bad_request" : "shipping_provider_validation_error", 422);
  }
  if (status === 404) {
    return new ShippingProviderError("O serviço de cotação do Melhor Envio não foi encontrado.", "shipping_provider_not_found", 502);
  }
  return new ShippingProviderError("O Melhor Envio está temporariamente indisponível. Tente novamente.",
    status >= 500 ? "shipping_provider_unavailable" : "shipping_provider_error", 502);
}

function logShippingRequest(tokenSource: "local_sandbox" | "vault", baseUrl: string, status: number | null, code?: string) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("shipping_quote", {
    token_source: tokenSource,
    environment: baseUrl === "https://sandbox.melhorenvio.com.br" ? "sandbox"
      : baseUrl === "https://melhorenvio.com.br" ? "production" : "other",
    http_status: status,
    ...(code ? { error_code: code } : {})
  });
}

function calculationEndpoint(baseUrl: string) {
  // Shipping is quotation-only: no configurable path or redirect may reach a purchase endpoint.
  let url: URL;
  try { url = new URL(baseUrl); }
  catch { throw new ShippingProviderError("Configuração de cotação inválida.", "shipping_endpoint_invalid", 503); }
  if (url.protocol !== "https:" || !["sandbox.melhorenvio.com.br", "melhorenvio.com.br"].includes(url.hostname) ||
      url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ShippingProviderError("Configuração de cotação inválida.", "shipping_endpoint_invalid", 503);
  }
  return `${url.origin}/api/v2/me/shipment/calculate`;
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
  const postalCode = normalizePostalCode(destinationZip);
  if (!postalCode) {
    throw new ShippingProviderError(POSTAL_CODE_MESSAGES.invalid, "invalid_postal_code", 400);
  }
  const configuration = options.configuration ?? getShippingConfiguration();
  const endpoint = calculationEndpoint(configuration.baseUrl);
  try {
    await lookupPostalCode(postalCode);
  } catch (error) {
    if (error instanceof PostalCodeError) {
      throw new ShippingProviderError(error.message, error.code, error.status);
    }
    throw error;
  }
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const localToken = getLocalMelhorEnvioSandboxAccessToken(configuration.baseUrl);
  const tokenSource = localToken ? "local_sandbox" : "vault";
  let accessToken: string;
  try {
    accessToken = localToken ?? await (options.getAccessToken ?? getValidMelhorEnvioAccessToken)();
  } catch (error) {
    if (error instanceof MelhorEnvioOAuthError) {
      throw new ShippingProviderError(error.message, error.code, error.status);
    }
    throw error;
  }
  const shipmentPayload = { ...buildShipmentPayload(postalCode, subtotalCents, configuration) };
  if (options.requestAllServicesForDiagnostics) {
    Reflect.deleteProperty(shipmentPayload, "services");
  }
  const signal = AbortSignal.timeout(12_000);
  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": configuration.userAgent
      },
      body: JSON.stringify(shipmentPayload),
      signal,
      redirect: "error",
      cache: "no-store"
    });
  } catch (error) {
    const failure = transportError(error, signal);
    logShippingRequest(tokenSource, configuration.baseUrl, null, failure.code);
    throw failure;
  }

  if (!response.ok) {
    const failure = providerHttpError(response.status, Boolean(localToken));
    logShippingRequest(tokenSource, configuration.baseUrl, response.status, failure.code);
    throw failure;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    const failure = isTimeout(error, signal) ? transportError(error, signal)
      : new ShippingProviderError("O Melhor Envio retornou uma resposta inválida.", "invalid_shipping_response");
    logShippingRequest(tokenSource, configuration.baseUrl, response.status, failure.code);
    throw failure;
  }

  try {
    options.onDiagnostics?.(createShippingServiceDiagnostics(body, [accessToken]));
  } catch {
    // Diagnostics must not change quote availability.
  }

  try {
    const quotes = parseShippingOptions(body, configuration.allowedServiceIds)
      .filter((quote) => ![quote.serviceId, quote.serviceName, quote.carrierName].some((value) => value.includes(accessToken)));
    logShippingRequest(tokenSource, configuration.baseUrl, response.status);
    return quotes;
  } catch (error) {
    logShippingRequest(tokenSource, configuration.baseUrl, response.status, "invalid_shipping_response");
    throw error;
  }
}
