import { NextResponse } from "next/server";
import { resolveAuthoritativeCheckoutCart } from "@/lib/checkout/catalog-server";
import { CheckoutValidationError } from "@/lib/checkout/catalog";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { checkoutRequestHash } from "@/lib/checkout/hash";
import { createOrderLookupLimiter } from "@/lib/orders/tracking-limit";
import { recoveryInputSchema, recoverySnapshot } from "@/lib/recovery/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const maxBytes = 32 * 1024;
const consume = createOrderLookupLimiter();
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const result = (status: number) => new NextResponse(null, { status, headers });

async function readPayload(request: Request) {
  if (!request.body || Number(request.headers.get("content-length")) > maxBytes ||
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const reader = request.body.getReader();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(text + decoder.decode()) as unknown;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally { reader.releaseLock(); }
}

function sameSite(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (origin === new URL(request.url).origin) return true;
  try {
    // Behind the proxy, Next can reconstruct the request with an internal host.
    const canonical = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    return ["https:", "http:"].includes(canonical.protocol) && origin === canonical.origin;
  } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameSite(request)) return result(403);
  if (consume()) return result(429);
  const parsed = recoveryInputSchema.safeParse(await readPayload(request));
  if (!parsed.success) return result(400);
  const input = parsed.data;
  const hash = checkoutRequestHash(input.token);
  if (consume(hash)) return result(429);

  try {
    const cart = input.items.length ? await resolveAuthoritativeCheckoutCart(input.items, "report") : null;
    // A recovery cannot turn an inquiry or a free/malformed line into a sale.
    if (cart && (!cart.items.length || cart.items.some(item => item.unitPriceCents <= 0))) return result(204);
    const { error } = await getSupabaseAdmin().rpc("ecommerce_record_checkout_recovery", {
      p_token_hash: hash, p_revision: input.revision, p_phone: input.phone, p_name: input.name,
      p_contact_allowed: input.contactAllowed, p_delivery: input.deliveryMethod,
      p_items: cart ? recoverySnapshot(cart) : [], p_subtotal: cart?.subtotalCents ?? 0,
      p_request_id: input.requestId ?? null
    }).abortSignal(AbortSignal.timeout(5000));
    return result(error ? 503 : 204);
  } catch (error) {
    if (error instanceof CheckoutValidationError) return result(204);
    return result(503);
  }
}
