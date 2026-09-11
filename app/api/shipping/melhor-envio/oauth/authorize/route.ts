import { NextRequest, NextResponse } from "next/server";
import { CheckoutConfigurationError, getMelhorEnvioOAuthSetupKey } from "@/lib/checkout/config";
import {
  MELHOR_ENVIO_OAUTH_STATE_COOKIE,
  buildMelhorEnvioAuthorizationUrl,
  createMelhorEnvioOAuthState,
  isAuthorizedMelhorEnvioSetupRequest,
  signMelhorEnvioOAuthState
} from "@/lib/checkout/melhor-envio-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  };
}

export async function GET(request: NextRequest) {
  try {
    const setupKey = getMelhorEnvioOAuthSetupKey();
    if (!isAuthorizedMelhorEnvioSetupRequest(request.headers.get("authorization"), setupKey)) {
      return new NextResponse("Autenticação administrativa necessária.", {
        status: 401,
        headers: {
          ...noStoreHeaders(),
          "WWW-Authenticate": 'Basic realm="Marjouxs Melhor Envio OAuth", charset="UTF-8"'
        }
      });
    }

    const state = createMelhorEnvioOAuthState();
    const response = NextResponse.redirect(buildMelhorEnvioAuthorizationUrl(state), 302);
    Object.entries(noStoreHeaders()).forEach(([name, value]) => response.headers.set(name, value));
    response.cookies.set({
      name: MELHOR_ENVIO_OAUTH_STATE_COOKIE,
      value: signMelhorEnvioOAuthState(state, setupKey),
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/shipping/melhor-envio/oauth/callback",
      maxAge: 10 * 60
    });
    return response;
  } catch (error) {
    const message =
      error instanceof CheckoutConfigurationError
        ? "A integração do Melhor Envio ainda não está configurada."
        : "Não foi possível iniciar a autorização do Melhor Envio.";
    return new NextResponse(message, { status: 503, headers: noStoreHeaders() });
  }
}
