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

function credentialStoreError() {
  return new MelhorEnvioOAuthError(
    "Não foi possível acessar a autorização do Melhor Envio.",
    "melhor_envio_credential_store_error",
    503
  );
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

async function callRpc(name: string, parameters?: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdmin().rpc(name, parameters);
  if (error) throw credentialStoreError();
  return data as unknown;
}

export function createMelhorEnvioCredentialStore(): MelhorEnvioCredentialStore {
  return {
    async get() {
      return parseStoredCredential(await callRpc("ecommerce_get_melhor_envio_oauth"));
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

  if (!credential) throw authorizationRequired();
  if (millisecondsUntilExpiration(credential, now()) > REFRESH_THRESHOLD_MS) return credential.accessToken;

  const claim = await store.claim();
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
