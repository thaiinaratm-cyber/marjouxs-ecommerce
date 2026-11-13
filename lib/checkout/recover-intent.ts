import "server-only";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { checkoutIdempotencyKey } from "@/lib/checkout/hash";
import { checkoutRecoveryState, type RecoveryState } from "@/lib/checkout/payment-state";

export async function recoverCheckoutIntent(requestId: string): Promise<RecoveryState> {
  const client = getSupabaseAdmin();
  const order = await client.from("ecommerce_orders")
    .select("id,payment_status,order_status")
    .eq("checkout_idempotency_key", checkoutIdempotencyKey(requestId)).maybeSingle();
  if (order.error) throw new Error("checkout_recovery_unavailable");
  if (!order.data) return "new";
  if (order.data.payment_status === "paid") return "paid";
  const attempt = await client.from("ecommerce_payment_attempts")
    .select("status,checkout_url,provider_checkout_id,request_metadata")
    .eq("order_id", order.data.id).order("created_at", { ascending: true }).order("id", { ascending: true })
    .limit(1).maybeSingle();
  if (attempt.error) throw new Error("checkout_recovery_unavailable");
  return checkoutRecoveryState(order.data, attempt.data);
}
