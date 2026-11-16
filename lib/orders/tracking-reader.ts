import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { normalizeOrderPhone, orderAccessTokenSchema } from "@/lib/orders/tracking";

function phoneDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export async function getVerifiedOrderAccessToken(orderNumber: string, phone: string) {
  const { data, error } = await getSupabaseAdmin().from("ecommerce_orders")
    .select("customer_phone, public_token").eq("order_number", orderNumber).maybeSingle();
  if (error) throw new Error("order_lookup_failed");
  const stored = typeof data?.customer_phone === "string" ? normalizeOrderPhone(data.customer_phone) : null;
  // Compare fixed-size values for both missing orders and mismatched phones.
  const same = timingSafeEqual(phoneDigest(stored ?? ""), phoneDigest(phone));
  const token = orderAccessTokenSchema.safeParse(data?.public_token);
  return stored && same && token.success ? token.data : null;
}
