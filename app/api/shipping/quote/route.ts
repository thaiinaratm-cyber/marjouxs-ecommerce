import { resolveAuthoritativeShipmentCart } from "@/lib/checkout/catalog-server";
import { apiError, checkoutJson, validationError } from "@/lib/checkout/http";
import { shippingQuoteRequestSchema } from "@/lib/checkout/schemas";
import { CheckoutConfigurationError } from "@/lib/checkout/config";
import { CheckoutValidationError } from "@/lib/checkout/catalog";
import { CheckoutCatalogReadError } from "@/lib/checkout/catalog-server";
import { publicShippingMessage } from "@/lib/checkout/shipping-messages";
import {
  quoteShipping,
  ShippingProviderError,
  type ShippingServiceDiagnostic
} from "@/lib/checkout/shipping";

export const runtime = "nodejs";

function logSandboxServices(services: ShippingServiceDiagnostic[]) {
  console.info("[Melhor Envio Sandbox][shipping/quote]", JSON.stringify(services));
}

function isMelhorEnvioSandbox() {
  const providerBaseUrl = process.env.MELHOR_ENVIO_BASE_URL ?? "https://sandbox.melhorenvio.com.br";
  return providerBaseUrl.includes("sandbox.melhorenvio.com.br");
}

export async function POST(request: Request) {
  try {
    const parsed = shippingQuoteRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    const cart = await resolveAuthoritativeShipmentCart(parsed.data.items);
    const sandboxDiagnostics = isMelhorEnvioSandbox();
    const options = await quoteShipping(
      parsed.data.postalCode,
      cart.subtotalCents,
      sandboxDiagnostics
        ? {
            onDiagnostics: logSandboxServices,
            requestAllServicesForDiagnostics: true
          }
        : {}
    );
    return checkoutJson({ options });
  } catch (error) {
    if (error instanceof ShippingProviderError) {
      return checkoutJson({ error: publicShippingMessage(error.code), code: error.code }, { status: error.status });
    }
    if (error instanceof CheckoutConfigurationError) {
      return checkoutJson({ error: publicShippingMessage(error.code), code: "shipping_unavailable" }, { status: 503 });
    }
    if (error instanceof CheckoutValidationError || error instanceof CheckoutCatalogReadError || error instanceof SyntaxError) {
      return apiError(error);
    }
    console.error("shipping_quote_failure", { code: "shipping_unavailable" });
    return checkoutJson({ error: publicShippingMessage("shipping_unavailable"), code: "shipping_unavailable" }, { status: 502 });
  }
}
