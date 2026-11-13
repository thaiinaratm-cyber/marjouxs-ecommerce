import "server-only";
import { normalizePostalCode, POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";

type PostalCodeAddress = {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export class PostalCodeError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "PostalCodeError";
  }
}

function unavailable() {
  return new PostalCodeError(POSTAL_CODE_MESSAGES.unavailable, "postal_code_service_unavailable", 503);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function createPostalCodeLookup(options: {
  fetchImplementation?: typeof fetch;
  now?: () => number;
} = {}) {
  const cache = new Map<string, { address: PostalCodeAddress; expiresAt: number }>();
  const pending = new Map<string, Promise<PostalCodeAddress>>();
  const now = options.now ?? Date.now;

  async function fetchAddress(postalCode: string): Promise<PostalCodeAddress> {
    try {
      const response = await (options.fetchImplementation ?? fetch)(`https://viacep.com.br/ws/${postalCode}/json/`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5_000)
      });
      if (!response.ok) throw unavailable();

      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw unavailable();
      const result = body as Record<string, unknown>;
      if (result.erro === true || result.erro === "true") {
        throw new PostalCodeError(POSTAL_CODE_MESSAGES.notFound, "postal_code_not_found", 404);
      }

      const city = text(result.localidade);
      const state = text(result.uf).toUpperCase();
      if (normalizePostalCode(result.cep) !== postalCode || !city || !/^[A-Z]{2}$/.test(state)) {
        throw unavailable();
      }
      return { postalCode, street: text(result.logradouro), neighborhood: text(result.bairro), city, state };
    } catch (error) {
      if (error instanceof PostalCodeError) throw error;
      throw unavailable();
    }
  }

  return async function lookupPostalCode(rawPostalCode: unknown): Promise<PostalCodeAddress> {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) {
      throw new PostalCodeError(POSTAL_CODE_MESSAGES.invalid, "invalid_postal_code", 400);
    }

    const cached = cache.get(postalCode);
    if (cached && cached.expiresAt > now()) return { ...cached.address };
    cache.delete(postalCode);

    let request = pending.get(postalCode);
    if (!request) {
      request = fetchAddress(postalCode).then((address) => {
        // Only server-validated successes are reused, for five minutes and at most 100 CEPs.
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(postalCode, { address, expiresAt: now() + 5 * 60_000 });
        return address;
      }).finally(() => pending.delete(postalCode));
      pending.set(postalCode, request);
    }
    return { ...await request };
  };
}

export const lookupPostalCode = createPostalCodeLookup();
