import { describe, expect, it, vi } from "vitest";
import {
  MELHOR_ENVIO_OAUTH_SCOPE,
  buildMelhorEnvioAuthorizationUrl,
  createMelhorEnvioOAuthState,
  exchangeMelhorEnvioAuthorizationCode,
  isAuthorizedMelhorEnvioSetupRequest,
  isValidMelhorEnvioOAuthState,
  refreshMelhorEnvioOAuthToken,
  signMelhorEnvioOAuthState
} from "@/lib/checkout/melhor-envio-oauth";

const configuration = {
  clientId: "client-id",
  clientSecret: "client-secret",
  baseUrl: "https://sandbox.melhorenvio.com.br",
  redirectUri: "https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/callback",
  userAgent: "Marjouxs Ecommerce (marjouxsgold@gmail.com)"
};

describe("Melhor Envio OAuth", () => {
  it("assina o state, valida o prazo e rejeita adulteração", () => {
    const now = Date.parse("2026-09-11T12:00:00.000Z");
    const state = createMelhorEnvioOAuthState(now);
    const signature = signMelhorEnvioOAuthState(state, "setup-secret");

    expect(isValidMelhorEnvioOAuthState(state, signature, "setup-secret", now + 60_000)).toBe(true);
    expect(isValidMelhorEnvioOAuthState(`${state}x`, signature, "setup-secret", now + 60_000)).toBe(false);
    expect(isValidMelhorEnvioOAuthState(state, signature, "setup-secret", now + 11 * 60_000)).toBe(false);
  });

  it("protege o início do fluxo por Basic ou Bearer sem aceitar credencial errada", () => {
    const basic = `Basic ${Buffer.from("marjouxs:setup-secret").toString("base64")}`;
    expect(isAuthorizedMelhorEnvioSetupRequest(basic, "setup-secret")).toBe(true);
    expect(isAuthorizedMelhorEnvioSetupRequest("Bearer setup-secret", "setup-secret")).toBe(true);
    expect(isAuthorizedMelhorEnvioSetupRequest("Bearer wrong", "setup-secret")).toBe(false);
  });

  it("gera a autorização com callback exato, state e escopo mínimo", () => {
    const url = buildMelhorEnvioAuthorizationUrl("state-value", configuration);
    expect(url.origin + url.pathname).toBe("https://sandbox.melhorenvio.com.br/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(configuration.redirectUri);
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("scope")).toBe(MELHOR_ENVIO_OAUTH_SCOPE);
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  it("troca o code no servidor e captura access, refresh e validade", async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          token_type: "Bearer",
          expires_in: 2_592_000,
          access_token: "new-access",
          refresh_token: "new-refresh"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(
      exchangeMelhorEnvioAuthorizationCode("one-time-code", {
        configuration,
        fetchImplementation: fetchImplementation as typeof fetch
      })
    ).resolves.toEqual({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 2_592_000 });

    const requestBody = JSON.parse(fetchImplementation.mock.calls[0][1]?.body as string);
    expect(requestBody).toMatchObject({
      grant_type: "authorization_code",
      code: "one-time-code",
      client_id: "client-id",
      client_secret: "client-secret",
      redirect_uri: configuration.redirectUri
    });
  });

  it("envia o refresh token rotativo ao endpoint oficial", async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          token_type: "Bearer",
          expires_in: 2_592_000,
          access_token: "rotated-access",
          refresh_token: "rotated-refresh"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const result = await refreshMelhorEnvioOAuthToken("current-refresh", {
      configuration,
      fetchImplementation: fetchImplementation as typeof fetch
    });

    expect(result.refreshToken).toBe("rotated-refresh");
    const requestBody = JSON.parse(fetchImplementation.mock.calls[0][1]?.body as string);
    expect(requestBody).toMatchObject({ grant_type: "refresh_token", refresh_token: "current-refresh" });
    expect(requestBody).not.toHaveProperty("redirect_uri");
  });
});
