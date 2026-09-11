import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc })
}));

import { GET as authorize } from "@/app/api/shipping/melhor-envio/oauth/authorize/route";
import { GET as callback } from "@/app/api/shipping/melhor-envio/oauth/callback/route";
import {
  MELHOR_ENVIO_OAUTH_STATE_COOKIE,
  createMelhorEnvioOAuthState,
  signMelhorEnvioOAuthState
} from "@/lib/checkout/melhor-envio-oauth";

const SETUP_KEY = "setup-secret-with-at-least-32-characters";

function callbackRequest(code: string | null, state: string, includeCookie = true) {
  const url = new URL("https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/callback");
  if (code !== null) url.searchParams.set("code", code);
  url.searchParams.set("state", state);
  const headers = new Headers();
  if (includeCookie) {
    headers.set(
      "Cookie",
      `${MELHOR_ENVIO_OAUTH_STATE_COOKIE}=${signMelhorEnvioOAuthState(state, SETUP_KEY)}`
    );
  }
  return new NextRequest(url, { headers });
}

describe("Rotas OAuth do Melhor Envio", () => {
  beforeEach(() => {
    vi.stubEnv("MELHOR_ENVIO_CLIENT_ID", "client-id");
    vi.stubEnv("MELHOR_ENVIO_CLIENT_SECRET", "private-client-secret");
    vi.stubEnv("MELHOR_ENVIO_BASE_URL", "https://sandbox.melhorenvio.com.br");
    vi.stubEnv(
      "MELHOR_ENVIO_REDIRECT_URI",
      "https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/callback"
    );
    vi.stubEnv("MELHOR_ENVIO_USER_AGENT", "Marjouxs Ecommerce (marjouxsgold@gmail.com)");
    vi.stubEnv("MELHOR_ENVIO_OAUTH_SETUP_KEY", SETUP_KEY);
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("bloqueia publicamente a rota de autorização", async () => {
    const response = await authorize(
      new NextRequest("https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/authorize")
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
    await expect(response.text()).resolves.not.toContain(SETUP_KEY);
  });

  it("inicia a autorização com cookie HttpOnly e sem client secret na URL", async () => {
    const authorization = `Basic ${Buffer.from(`marjouxs:${SETUP_KEY}`).toString("base64")}`;
    const response = await authorize(
      new NextRequest("https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/authorize", {
        headers: { Authorization: authorization }
      })
    );
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(302);
    expect(location.origin + location.pathname).toBe("https://sandbox.melhorenvio.com.br/oauth/authorize");
    expect(location.searchParams.has("client_secret")).toBe(false);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejeita callback sem code e callback com state inválido", async () => {
    const state = createMelhorEnvioOAuthState();
    const missingCode = await callback(callbackRequest(null, state));
    const invalidState = await callback(
      new NextRequest(
        `https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/callback?code=code&state=${state}`,
        { headers: { Cookie: `${MELHOR_ENVIO_OAUTH_STATE_COOKIE}=invalid` } }
      )
    );

    expect(missingCode.status).toBe(400);
    expect(invalidState.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("não armazena uma resposta do provedor sem access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ token_type: "Bearer", expires_in: 3600, refresh_token: "refresh-only" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const response = await callback(callbackRequest("one-time-code", createMelhorEnvioOAuthState()));

    expect(response.status).toBe(502);
    expect(mocks.rpc).not.toHaveBeenCalled();
    await expect(response.text()).resolves.not.toContain("refresh-only");
  });

  it("troca, armazena um token válido e rejeita replay sem o cookie de state", async () => {
    const providerFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          token_type: "Bearer",
          expires_in: 2_592_000,
          access_token: "private-access-token",
          refresh_token: "private-refresh-token"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", providerFetch);
    const state = createMelhorEnvioOAuthState();

    const response = await callback(callbackRequest("one-time-code", state));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_store_melhor_envio_oauth", {
      p_access_token: "private-access-token",
      p_refresh_token: "private-refresh-token",
      p_expires_in: 2_592_000
    });
    const html = await response.text();
    expect(html).not.toContain("one-time-code");
    expect(html).not.toContain("private-access-token");
    expect(html).not.toContain("private-refresh-token");
    expect(html).not.toContain("private-client-secret");

    const replay = await callback(callbackRequest("one-time-code", state, false));
    expect(replay.status).toBe(400);
    expect(providerFetch).toHaveBeenCalledOnce();
  });
});
