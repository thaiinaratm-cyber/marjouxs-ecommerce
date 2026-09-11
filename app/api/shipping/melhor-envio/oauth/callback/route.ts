import { NextRequest, NextResponse } from "next/server";
import { CheckoutConfigurationError, getMelhorEnvioOAuthSetupKey } from "@/lib/checkout/config";
import {
  MELHOR_ENVIO_OAUTH_STATE_COOKIE,
  MelhorEnvioOAuthError,
  exchangeMelhorEnvioAuthorizationCode,
  isValidMelhorEnvioOAuthState
} from "@/lib/checkout/melhor-envio-oauth";
import { storeMelhorEnvioOAuthCredentials } from "@/lib/checkout/melhor-envio-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALLBACK_PATH = "/api/shipping/melhor-envio/oauth/callback";

function callbackHtml(title: string, message: string) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body{margin:0;background:#f7f4ef;color:#181512;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}
      main{max-width:560px;background:#fff;border:1px solid #ded6c8;border-radius:8px;padding:32px;text-align:center;box-shadow:0 12px 36px rgba(25,20,12,.08)}
      h1{font-family:Georgia,serif;font-size:28px;margin:0 0 12px}p{line-height:1.6;margin:0;color:#5a5146}
    </style>
  </head>
  <body><main><h1>${title}</h1><p>${message}</p></main></body>
</html>`;
}

function callbackResponse(title: string, message: string, status: number) {
  const response = new NextResponse(callbackHtml(title, message), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
  response.cookies.set({
    name: MELHOR_ENVIO_OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: CALLBACK_PATH,
    maxAge: 0
  });
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const providerError = request.nextUrl.searchParams.has("error");
    const setupKey = getMelhorEnvioOAuthSetupKey();
    const stateSignature = request.cookies.get(MELHOR_ENVIO_OAUTH_STATE_COOKIE)?.value;

    if (!isValidMelhorEnvioOAuthState(state, stateSignature, setupKey)) {
      return callbackResponse(
        "Autorização inválida",
        "A sessão de autorização expirou ou já foi utilizada. Inicie o processo novamente.",
        400
      );
    }
    if (providerError) {
      return callbackResponse(
        "Autorização cancelada",
        "O Melhor Envio não concedeu a autorização. Você pode fechar esta janela e tentar novamente.",
        400
      );
    }
    if (!code) {
      return callbackResponse(
        "Autorização incompleta",
        "O código de autorização não foi recebido. Inicie o processo novamente.",
        400
      );
    }

    const tokens = await exchangeMelhorEnvioAuthorizationCode(code);
    await storeMelhorEnvioOAuthCredentials(tokens);
    return callbackResponse(
      "Melhor Envio conectado",
      "A autorização foi armazenada com segurança. Esta janela já pode ser fechada.",
      200
    );
  } catch (error) {
    const configurationError = error instanceof CheckoutConfigurationError;
    const authorizationError = error instanceof MelhorEnvioOAuthError;
    return callbackResponse(
      "Não foi possível conectar",
      configurationError
        ? "A configuração da integração está incompleta. Revise as variáveis do servidor e tente novamente."
        : authorizationError
          ? "O Melhor Envio recusou ou não concluiu a autorização. Inicie o processo novamente."
          : "Ocorreu uma falha ao armazenar a autorização. Tente novamente em instantes.",
      configurationError ? 503 : 502
    );
  }
}
