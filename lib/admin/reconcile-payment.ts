import "server-only";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { verifyInfinitePayPayment, type VerificationAttempt } from "@/lib/checkout/verify-payment";
import { canReconcileAttempt } from "@/lib/checkout/payment-state";

export type ReconciliationResult =
  | "reconcile_paid" | "reconcile_already_paid" | "reconcile_pending"
  | "reconcile_review" | "reconcile_conflict" | "reconcile_unavailable"
  | "reconcile_missing_reference";

type StoredAttempt = VerificationAttempt & { order_nsu: string; receipt_url: string | null; failure_code?: string | null };

export async function reconcileAdminOrderPayment(orderId: string): Promise<ReconciliationResult> {
  // Never reach the service-role client before checking the current cookie session.
  await requireActiveAdmin();
  if (!z.string().uuid().safeParse(orderId).success) return "reconcile_unavailable";
  try {
    const client = getSupabaseAdmin();
    const order = await client.from("ecommerce_orders")
      .select("id,payment_status,order_status,payment_provider").eq("id", orderId).maybeSingle();
    if (order.error || !order.data) return "reconcile_unavailable";
    if (order.data.payment_status === "paid") return "reconcile_already_paid";
    if (order.data.payment_provider !== "infinitepay" || !["pending", "requires_review"].includes(order.data.payment_status) ||
        order.data.order_status === "cancelled") return "reconcile_unavailable";
    const result = await client.from("ecommerce_payment_attempts")
      .select("id,order_id,order_nsu,status,requested_amount_cents,provider_checkout_id,transaction_nsu,receipt_url,failure_code")
      .eq("order_id", orderId).eq("provider", "infinitepay")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const attempt = result.data as StoredAttempt | null;
    // Includes legacy creating/dispatch-unknown attempts: no provider call or mutation.
    if (result.error || !attempt || !canReconcileAttempt(order.data.payment_status, attempt)) return "reconcile_unavailable";
    if (!attempt.order_nsu?.trim() || !attempt.provider_checkout_id?.trim() || !attempt.transaction_nsu?.trim()) {
      return "reconcile_missing_reference";
    }
    const verification = await verifyInfinitePayPayment(attempt, {
      orderNsu: attempt.order_nsu, invoiceSlug: attempt.provider_checkout_id,
      transactionNsu: attempt.transaction_nsu, receiptUrl: attempt.receipt_url
    });
    if (verification.status === 200) {
      return verification.body.code === "paid" ? "reconcile_paid" : "reconcile_already_paid";
    }
    if (verification.body.code === "payment_not_confirmed") return "reconcile_pending";
    if (verification.body.code.endsWith("conflict")) return "reconcile_conflict";
    return verification.status === 409 ? "reconcile_review" : "reconcile_unavailable";
  } catch {
    return "reconcile_unavailable";
  }
}
