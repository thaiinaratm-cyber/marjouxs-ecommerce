import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import {
  MelhorEnvioOAuthError,
  refreshMelhorEnvioOAuthToken,
  type MelhorEnvioOAuthTokens
} from "@/lib/checkout/melhor-envio-oauth";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const MINIMUM_USABLE_TOKEN_MS = 30 * 1000;
const DEFAULT_WAIT_ATTEMPTS = 12;
const DEFAULT_WAIT_INTERVAL_MS = 350;
const COMPLETE_RETRY_ATTEMPTS = 3;
const READ_RPC_ATTEMPTS = 3;
const READ_RPC_RETRY_DELAY_MS = 150;

type StoredCredential = { accessToken: string; expiresAt: string };
type RefreshClaim = {
  claimed: boolean;
  lockToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type MelhorEnvioCredentialStore = {
  get(): Promise<StoredCredential | null>;
  claim(): Promise<RefreshClaim>;
  complete(lockToken: string, tokens: MelhorEnvioOAuthTokens): Promise<boolean>;
  release(lockToken: string): Promise<boolean>;
};

type TokenManagerOptions = {
  store?: MelhorEnvioCredentialStore;
  refreshToken?: (refreshToken: string) => Promise<MelhorEnvioOAuthTokens>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  waitAttempts?: number;
  waitIntervalMs?: number;
};

function oauthDiagnostic(event: string, details: Record<string, unknown>) {
  if (process.env.MELHOR_ENVIO_OAUTH_DIAGNOSTICS !== "true") return;
  console.info(`[Melhor Envio OAuth][${event}]`, JSON.stringify(details));
}

function credentialStoreError() {
  return new MelhorEnvioOAuthError(
    "Não foi possível consultar a integração de frete neste momento.",
    "melhor_envio_integration_error",
    503
  );
}

function rpcErrorCategory(error: unknown) {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  const message = isRecord(error) && typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (message.includes("fetch") || message.includes("network")) return "network";
  if (code === "42501") return "permission";
  if (code.startsWith("PGRST")) return "database_api";
  if (code) return "database";
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstRpcRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function requiredString(row: Record<string, unknown>, field: string) {
  const value = row[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStoredCredential(value: unknown): StoredCredential | null {
  const row = firstRpcRow(value);
  oauthDiagnostic("credential_shape", {
    row_present: row !== null && row !== undefined,
    access_token_present: isRecord(row) && typeof row.access_token === "string" && row.access_token.length > 0,
    access_token_type: isRecord(row) ? typeof row.access_token : null,
    expires_at: isRecord(row) && typeof row.expires_at === "string" ? row.expires_at : null,
    expires_at_type: isRecord(row) ? typeof row.expires_at : null
  });
  if (row === null || row === undefined) return null;
  if (!isRecord(row)) throw credentialStoreError();

  const accessToken = requiredString(row, "access_token");
  const expiresAt = requiredString(row, "expires_at");
  if (!accessToken || !expiresAt || !Number.isFinite(Date.parse(expiresAt))) {
    throw credentialStoreError();
  }
  return { accessToken, expiresAt };
}

function parseRefreshClaim(value: unknown): RefreshClaim {
  const row = firstRpcRow(value);
  if (!isRecord(row) || typeof row.claimed !== "boolean") throw credentialStoreError();
  return {
    claimed: row.claimed,
    lockToken: requiredString(row, "lock_token"),
    refreshToken: requiredString(row, "refresh_token"),
    expiresAt: requiredString(row, "expires_at")
  };
}

async function callRpc(
  name: string,
  parameters?: Record<string, unknown>,
  options: { attempts?: number } = {}
) {
  const attempts = options.attempts ?? 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { data, error } = await getSupabaseAdmin().rpc(name, parameters);
      if (!error) {
        oauthDiagnostic("rpc_success", {
          rpc: name,
          attempt,
          rows: Array.isArray(data) ? data.length : data === null ? 0 : 1
        });
        return data as unknown;
      }
      oauthDiagnostic("rpc_error", {
        rpc: name,
        attempt,
        error_code: typeof error.code === "string" && error.code ? error.code : null,
        error_category: rpcErrorCategory(error)
      });
    } catch (error) {
      oauthDiagnostic("rpc_error", {
        rpc: name,
        attempt,
        error_code: null,
        error_category: rpcErrorCategory(error)
      });
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, READ_RPC_RETRY_DELAY_MS * attempt));
    }
  }
  throw credentialStoreError();
}

export function createMelhorEnvioCredentialStore(): MelhorEnvioCredentialStore {
  return {
    async get() {
      return parseStoredCredential(
        await callRpc("ecommerce_get_melhor_envio_oauth", undefined, { attempts: READ_RPC_ATTEMPTS })
      );
    },
    async claim() {
      return parseRefreshClaim(await callRpc("ecommerce_claim_melhor_envio_refresh"));
    },
    async complete(lockToken, tokens) {
      const result = await callRpc("ecommerce_complete_melhor_envio_refresh", {
        p_lock_token: lockToken,
        p_access_token: tokens.accessToken,
        p_refresh_token: tokens.refreshToken,
        p_expires_in: tokens.expiresIn
      });
      if (typeof result !== "boolean") throw credentialStoreError();
      return result;
    },
    async release(lockToken) {
      const result = await callRpc("ecommerce_release_melhor_envio_refresh", { p_lock_token: lockToken });
      if (typeof result !== "boolean") throw credentialStoreError();
      return result;
    }
  };
}

export async function storeMelhorEnvioOAuthCredentials(tokens: MelhorEnvioOAuthTokens) {
  await callRpc("ecommerce_store_melhor_envio_oauth", {
    p_access_token: tokens.accessToken,
    p_refresh_token: tokens.refreshToken,
    p_expires_in: tokens.expiresIn
  });
}

function millisecondsUntilExpiration(credential: StoredCredential, now: number) {
  return Date.parse(credential.expiresAt) - now;
}

function authorizationRequired() {
  return new MelhorEnvioOAuthError(
    "O Melhor Envio precisa ser autorizado antes de calcular o frete.",
    "melhor_envio_authorization_required",
    503
  );
}

async function releaseClaimSafely(store: MelhorEnvioCredentialStore, lockToken: string) {
  try {
    await store.release(lockToken);
  } catch {
    // The database lock expiry lets a later request retry safely.
  }
}

async function completeRefreshSafely(
  store: MelhorEnvioCredentialStore,
  lockToken: string,
  tokens: MelhorEnvioOAuthTokens,
  sleep: (milliseconds: number) => Promise<void>
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < COMPLETE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await store.complete(lockToken, tokens);
    } catch (error) {
      lastError = error;
      if (attempt < COMPLETE_RETRY_ATTEMPTS - 1) await sleep(100 * (attempt + 1));
    }
  }
  throw lastError;
}

async function waitForRefreshedCredential(
  store: MelhorEnvioCredentialStore,
  currentCredential: StoredCredential,
  options: Required<Pick<TokenManagerOptions, "now" | "sleep" | "waitAttempts" | "waitIntervalMs">>
) {
  for (let attempt = 0; attempt < options.waitAttempts; attempt += 1) {
    await options.sleep(options.waitIntervalMs);
    const credential = await store.get();
    if (credential && millisecondsUntilExpiration(credential, options.now()) > REFRESH_THRESHOLD_MS) {
      return credential.accessToken;
    }
  }

  if (millisecondsUntilExpiration(currentCredential, options.now()) > MINIMUM_USABLE_TOKEN_MS) {
    return currentCredential.accessToken;
  }
  throw new MelhorEnvioOAuthError(
    "A autorização do Melhor Envio está sendo renovada. Tente novamente em instantes.",
    "melhor_envio_refresh_in_progress",
    503
  );
}

export async function getValidMelhorEnvioAccessToken(options: TokenManagerOptions = {}) {
  const store = options.store ?? createMelhorEnvioCredentialStore();
  const refreshToken = options.refreshToken ?? refreshMelhorEnvioOAuthToken;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const waitAttempts = options.waitAttempts ?? DEFAULT_WAIT_ATTEMPTS;
  const waitIntervalMs = options.waitIntervalMs ?? DEFAULT_WAIT_INTERVAL_MS;
  const credential = await store.get();

  if (!credential) {
    oauthDiagnostic("credential_missing", {});
    throw authorizationRequired();
  }
  const remainingMilliseconds = millisecondsUntilExpiration(credential, now());
  oauthDiagnostic("credential_loaded", {
    expires_at: credential.expiresAt,
    remaining_seconds: Math.floor(remainingMilliseconds / 1000),
    refresh_required: remainingMilliseconds <= REFRESH_THRESHOLD_MS
  });
  if (remainingMilliseconds > REFRESH_THRESHOLD_MS) {
    oauthDiagnostic("access_token_reused", {});
    return credential.accessToken;
  }

  oauthDiagnostic("refresh_claim_requested", {});
  const claim = await store.claim();
  oauthDiagnostic("refresh_claim_result", {
    claimed: claim.claimed,
    lock_token_present: Boolean(claim.lockToken),
    refresh_token_present: Boolean(claim.refreshToken),
    expires_at: claim.expiresAt
  });
  if (!claim.claimed) {
    return waitForRefreshedCredential(store, credential, { now, sleep, waitAttempts, waitIntervalMs });
  }
  if (!claim.lockToken || !claim.refreshToken) throw credentialStoreError();

  let tokens: MelhorEnvioOAuthTokens;
  try {
    tokens = await refreshToken(claim.refreshToken);
  } catch (error) {
    await releaseClaimSafely(store, claim.lockToken);
    throw error;
  }

  let completed: boolean;
  try {
    completed = await completeRefreshSafely(store, claim.lockToken, tokens, sleep);
  } catch {
    // Do not release after rotation: the previous refresh token must never be reused.
    const latestCredential = await store.get().catch(() => null);
    if (latestCredential && millisecondsUntilExpiration(latestCredential, now()) > REFRESH_THRESHOLD_MS) {
      return latestCredential.accessToken;
    }
    throw credentialStoreError();
  }

  if (completed) return tokens.accessToken;
  return waitForRefreshedCredential(store, credential, { now, sleep, waitAttempts, waitIntervalMs });
}
