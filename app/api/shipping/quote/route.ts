import { NextResponse } from "next/server";
import { resolveAuthoritativeShipmentCart } from "@/lib/checkout/catalog-server";
import { apiError, validationError } from "@/lib/checkout/http";
import { shippingQuoteRequestSchema } from "@/lib/checkout/schemas";
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
    return NextResponse.json({ options });
  } catch (error) {
    if (error instanceof ShippingProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return apiError(error);
  }
}
