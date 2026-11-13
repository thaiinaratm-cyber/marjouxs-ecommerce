import type { z } from "zod";
import type { createCheckoutSchema } from "@/lib/checkout/schemas";
import type { CartLineInput } from "@/types/checkout";

export const CHECKOUT_INTENT_STORAGE_KEY = "marjouxs-checkout-intent-v1";
export const CHECKOUT_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
export const CHECKOUT_INTENT_LOCK = "marjouxs-checkout-intent";

type CheckoutRequest = z.infer<typeof createCheckoutSchema>;
export type CheckoutIntentInput = Pick<CheckoutRequest, "customer" | "delivery"> & {
  items: CartLineInput[];
  shippingCents: number;
  totalCents: number;
  cartLineIds?: string[];
};
export type CheckoutIntent = {
  version: 2; requestId: string; fingerprint: string; createdAt: number; expiresAt: number;
};
type IntentStorage = Pick<Storage, "getItem" | "setItem">;
type IntentCrypto = Pick<Crypto, "subtle" | "randomUUID">;

export class CheckoutIntentError extends Error {
  constructor(message = "Não foi possível preservar esta tentativa no navegador. Fale com nossa equipe antes de iniciar outra tentativa.") {
    super(message);
    this.name = "CheckoutIntentError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

export function canonicalCheckoutJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

// Quote UUIDs/timestamps can change on refresh without changing the purchase.
export function checkoutIntentSnapshot(input: CheckoutIntentInput) {
  const delivery = input.delivery.method === "pickup" ? input.delivery : {
    method: "shipping",
    address: Object.fromEntries(Object.entries(input.delivery.address)
      .filter(([key]) => key !== "shippingQuoteId"))
  };
  return {
    customer: { ...input.customer, cpf: input.customer.cpf || "" },
    delivery,
    items: input.items.map((item) => ({
      productId: item.productId, productSlug: item.productSlug,
      quantity: item.quantity, customization: item.customization ?? null,
      unitPriceCents: item.displayedUnitPriceCents
    })).sort((left, right) => canonicalCheckoutJson(left).localeCompare(canonicalCheckoutJson(right))),
    shippingCents: input.shippingCents,
    totalCents: input.totalCents
  };
}

export async function getOrCreateCheckoutIntent(
  storage: IntentStorage,
  input: CheckoutIntentInput,
  cryptoImplementation: IntentCrypto = globalThis.crypto,
  now = Date.now(),
  legacyStorage?: IntentStorage
): Promise<CheckoutIntent> {
  try {
    const digest = await cryptoImplementation.subtle.digest("SHA-256",
      new TextEncoder().encode(canonicalCheckoutJson({
        purchase: checkoutIntentSnapshot(input),
        // Existing cart IDs distinguish a new purchase after the previous cart was cleared.
        cartLineIds: input.cartLineIds ? [...input.cartLineIds].sort() : undefined
      })));
    const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    // One slot per purchase prevents a second tab from replacing the first tab's identity.
    const key = `${CHECKOUT_INTENT_STORAGE_KEY}:${fingerprint}`;
    const stored = storage.getItem(key) ?? storage.getItem(CHECKOUT_INTENT_STORAGE_KEY)
      ?? legacyStorage?.getItem(CHECKOUT_INTENT_STORAGE_KEY) ?? null;
    if (stored !== null) {
      const previous = JSON.parse(stored) as Partial<Omit<CheckoutIntent, "version">> & { version?: number };
      if (!previous || ![1, 2].includes(previous.version ?? 0) || typeof previous.requestId !== "string" ||
          !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(previous.requestId) ||
          typeof previous.fingerprint !== "string" || !/^[\da-f]{64}$/.test(previous.fingerprint)) {
        throw new CheckoutIntentError();
      }
      if (previous.fingerprint === fingerprint) {
        // V1 has no trustworthy creation time: preserve its ID but do not grant a new lease.
        const intent: CheckoutIntent = previous.version === 1
          ? { version: 2, requestId: previous.requestId, fingerprint, createdAt: 0, expiresAt: 0 }
          : { version: 2, requestId: previous.requestId, fingerprint,
              createdAt: previous.createdAt!, expiresAt: previous.expiresAt! };
        if (!Number.isSafeInteger(intent.createdAt) || !Number.isSafeInteger(intent.expiresAt) ||
            intent.createdAt < 0 || intent.createdAt > now || intent.expiresAt < intent.createdAt ||
            intent.expiresAt - intent.createdAt > CHECKOUT_INTENT_TTL_MS) throw new CheckoutIntentError();
        storage.setItem(key, JSON.stringify(intent));
        return intent;
      }
    }
    const intent: CheckoutIntent = { version: 2, requestId: cryptoImplementation.randomUUID(), fingerprint,
      createdAt: now, expiresAt: now + CHECKOUT_INTENT_TTL_MS };
    const encoded = JSON.stringify(intent);
    storage.setItem(key, encoded);
    if (storage.getItem(key) !== encoded) throw new CheckoutIntentError();
    return intent;
  } catch {
    // Fail before creating an order if refresh safety cannot be persisted.
    throw new CheckoutIntentError();
  }
}

export function assertCheckoutIntentUsable(intent: CheckoutIntent, state: string, now = Date.now()) {
  if (state === "paid") throw new CheckoutIntentError("Este pedido já está pago. Consulte sua confirmação ou fale com a Marjouxs.");
  if (state === "requires_review") throw new CheckoutIntentError("Seu pagamento está em verificação. Fale com a Marjouxs antes de tentar novamente.");
  if (["failed", "cancelled", "blocked", "legacy", "dispatch_unknown"].includes(state)) {
    throw new CheckoutIntentError("Esta tentativa precisa de atendimento. Nenhum novo pagamento foi iniciado.");
  }
  if (now >= intent.expiresAt) {
    throw new CheckoutIntentError("O prazo desta tentativa no navegador terminou. Isso não cancela nem expira o pagamento. Fale com a Marjouxs antes de iniciar outro.");
  }
  if (!["new", "pending", "pre_dispatch"].includes(state)) throw new CheckoutIntentError();
}

export async function prepareBrowserCheckoutIntent(input: CheckoutIntentInput): Promise<CheckoutIntent> {
  // Web Locks serialize allocation across tabs; PostgreSQL still authorizes the dispatch.
  if (!navigator.locks) throw new CheckoutIntentError();
  return navigator.locks.request(CHECKOUT_INTENT_LOCK, async () => {
    const intent = await getOrCreateCheckoutIntent(window.localStorage, input, globalThis.crypto, Date.now(), window.sessionStorage);
    const response = await fetch("/api/checkout/intent", {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: intent.requestId }), referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(10_000)
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== "object" || !("state" in body) || typeof body.state !== "string") {
      throw new CheckoutIntentError();
    }
    assertCheckoutIntentUsable(intent, body.state);
    return intent;
  }).catch(error => {
    if (error instanceof CheckoutIntentError) throw error;
    throw new CheckoutIntentError();
  });
}
