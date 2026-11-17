import { recoveryDays, recoveryPhoneSchema } from "@/lib/recovery/model";
import type { CartLineInput } from "@/types/checkout";

const key = "marjouxs-recovery-v1";
const ttl = recoveryDays * 24 * 60 * 60 * 1000;
type RecoverySession = { seed: string; createdAt: number; lineIds: string[]; revision: number };
type RecoveryInput = {
  phone: string; name: string; contactAllowed: boolean; deliveryMethod: "pickup" | "shipping";
  items: CartLineInput[]; lineIds: string[]; requestId?: string;
};

export function allocateRecovery(
  storage: Pick<Storage, "getItem" | "setItem">, lineIds: string[], now: number, seed: () => string
): RecoverySession | null {
  const previous = JSON.parse(storage.getItem(key) ?? "null") as RecoverySession | null;
  const current = previous && typeof previous.seed === "string" && Array.isArray(previous.lineIds)
    && Number.isSafeInteger(previous.revision) && now >= previous.createdAt && now - previous.createdAt < ttl
    ? previous : null;
  if (!lineIds.length && !current) return null;
  const existing = current && (!lineIds.length || lineIds.some(id => current.lineIds.includes(id)));
  const next = existing
    ? { ...current, revision: current.revision + 1, lineIds: lineIds.length ? lineIds : current.lineIds }
    : { seed: seed(), createdAt: now, lineIds, revision: 1 };
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export async function recordBrowserCheckoutRecovery(input: RecoveryInput, signal?: AbortSignal) {
  try {
    const phone = recoveryPhoneSchema.safeParse(input.phone);
    if (!phone.success || !navigator.locks || signal?.aborted) return;
    const session = await navigator.locks.request(key, () =>
      signal?.aborted ? null : allocateRecovery(window.localStorage, input.lineIds, Date.now(), () => crypto.randomUUID()));
    if (!session || signal?.aborted) return;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${session.seed}:${phone.data}`));
    if (signal?.aborted) return;
    const token = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const { name, contactAllowed, deliveryMethod, requestId } = input;
    const items = input.items.map(({ productId, productSlug, quantity, customization }) =>
      ({ productId, productSlug, quantity, customization }));
    await fetch("/api/checkout/recovery", {
      method: "POST", keepalive: true, cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, revision: session.revision, phone: phone.data, name, contactAllowed, deliveryMethod, items, requestId })
    });
  } catch {
    // Recovery is optional; it must not affect checkout or a payment redirect.
  }
}
