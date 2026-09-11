import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getMelhorEnvioOAuthConfiguration } from "@/lib/checkout/config";

const STATE_TTL_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;

const tokenResponseSchema = z.object({
  token_type: z.string().min(1),
  expires_in: z.coerce.number().int().positive(),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1)
});

export const MELHOR_ENVIO_OAUTH_STATE_COOKIE = "marjouxs_me_oauth_state";
export const MELHOR_ENVIO_OAUTH_SCOPE = "shipping-calculate";

export type MelhorEnvioOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type OAuthConfiguration = ReturnType<typeof getMelhorEnvioOAuthConfiguration>;
type FetchImplementation = typeof fetch;

export class MelhorEnvioOAuthError extends Error {
  constructor(message: string, readonly code: string, readonly status = 503) {
    super(message);
    this.name = "MelhorEnvioOAuthError";
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createMelhorEnvioOAuthState(now = Date.now()) {
  const nonce = randomBytes(32).toString("base64url");
  return `${nonce}.${Math.floor(now / 1000)}`;
}

export function signMelhorEnvioOAuthState(state: string, setupKey: string) {
  return createHmac("sha256", setupKey).update(state).digest("base64url");
}

export function isValidMelhorEnvioOAuthState(
  state: string | null,
  signature: string | undefined,
  setupKey: string,
  now = Date.now()
) {
  if (!state || !signature || setupKey.length < 1) {
    return false;
  }

  const [nonce, issuedAtRaw, ...extraParts] = state.split(".");
  const issuedAt = Number(issuedAtRaw);
  const ageSeconds = Math.floor(now / 1000) - issuedAt;
  if (
    extraParts.length > 0 ||
    !/^[A-Za-z0-9_-]{40,}$/.test(nonce ?? "") ||
    !Number.isInteger(issuedAt) ||
    ageSeconds < -CLOCK_SKEW_SECONDS ||
    ageSeconds > STATE_TTL_SECONDS
  ) {
    return false;
  }

  return safeEqual(signature, signMelhorEnvioOAuthState(state, setupKey));
}

function setupKeyFromAuthorizationHeader(header: string | null) {
  if (!header) {
    return null;
  }

  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() || null;
  }

  if (header.startsWith("Basic ")) {
    try {
      const credentials = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
      const separator = credentials.indexOf(":");
      if (separator < 0 || credentials.slice(0, separator) !== "marjouxs") {
        return null;
      }
      return credentials.slice(separator + 1) || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function isAuthorizedMelhorEnvioSetupRequest(header: string | null, setupKey: string) {
  const providedKey = setupKeyFromAuthorizationHeader(header);
  return providedKey ? safeEqual(providedKey, setupKey) : false;
}

export function buildMelhorEnvioAuthorizationUrl(
  state: string,
  configuration: OAuthConfiguration = getMelhorEnvioOAuthConfiguration()
) {
  const authorizationUrl = new URL("/oauth/authorize", `${configuration.baseUrl}/`);
  authorizationUrl.searchParams.set("client_id", configuration.clientId);
  authorizationUrl.searchParams.set("redirect_uri", configuration.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", MELHOR_ENVIO_OAUTH_SCOPE);
  return authorizationUrl;
}

async function requestOAuthToken(
  payload: Record<string, string>,
  options: {
    configuration?: OAuthConfiguration;
    fetchImplementation?: FetchImplementation;
  } = {}
): Promise<MelhorEnvioOAuthTokens> {
  const configuration = options.configuration ?? getMelhorEnvioOAuthConfiguration();
  const fetchImplementation = options.fetchImplementation ?? fetch;

  let response: Response;
  try {
    response = await fetchImplementation(new URL("/oauth/token", `${configuration.baseUrl}/`), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": configuration.userAgent
      },
      body: JSON.stringify({
        ...payload,
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store"
    });
  } catch {
    throw new MelhorEnvioOAuthError(
      "Não foi possível comunicar com a autenticação do Melhor Envio.",
      "melhor_envio_oauth_unavailable",
      502
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new MelhorEnvioOAuthError(
      "O Melhor Envio retornou uma resposta de autenticação inválida.",
      "melhor_envio_oauth_invalid_response",
      502
    );
  }

  if (!response.ok) {
    throw new MelhorEnvioOAuthError(
      "A autorização do Melhor Envio não pôde ser concluída.",
      "melhor_envio_oauth_rejected",
      response.status >= 500 ? 502 : 401
    );
  }

  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new MelhorEnvioOAuthError(
      "O Melhor Envio retornou credenciais inválidas.",
      "melhor_envio_oauth_invalid_response",
      502
    );
  }

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expires_in
  };
}

export function exchangeMelhorEnvioAuthorizationCode(
  code: string,
  options: {
    configuration?: OAuthConfiguration;
    fetchImplementation?: FetchImplementation;
  } = {}
) {
  const configuration = options.configuration ?? getMelhorEnvioOAuthConfiguration();
  return requestOAuthToken(
    {
      grant_type: "authorization_code",
      redirect_uri: configuration.redirectUri,
      code
    },
    { ...options, configuration }
  );
}

export function refreshMelhorEnvioOAuthToken(
  refreshToken: string,
  options: {
    configuration?: OAuthConfiguration;
    fetchImplementation?: FetchImplementation;
  } = {}
) {
  return requestOAuthToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken
    },
    options
  );
}
