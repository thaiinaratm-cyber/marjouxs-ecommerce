import "server-only";
import { checkInfinitePayPayment, InfinitePayError } from "@/lib/checkout/infinitepay";
import { evaluatePaymentAmounts } from "@/lib/checkout/payment-validation";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { ensurePaidOrderEvent } from "@/lib/notifications/order-paid";

export type VerificationAttempt = {
  id: string;
  order_id?: string;
  requested_amount_cents: unknown;
  provider_checkout_id: string | null;
  checkout_url?: string | null;
  transaction_nsu: string | null;
  status: string;
};
export type PaymentReferences = {
  orderNsu: string;
  invoiceSlug: string;
  transactionNsu: string;
  receiptUrl?: string | null;
};
type ConfirmationRow = {
  result_code: string;
  result_newly_paid: boolean;
  result_order_id: string;
  result_order_number: string;
  result_payment_status: string;
};
export type PaymentVerificationResult = {
  status: number;
  body: { code: string; received?: boolean; error?: string };
};

async function enqueuePaidEvent(orderId: string) {
  try { await ensurePaidOrderEvent(orderId); }
  catch { console.error("order_paid_notification_failure", { stage: "enqueue", code: "notification_event_write_failed" }); }
}

async function markForReview(attemptId: string, code: string, detail: string) {
  try {
    const { error } = await getSupabaseAdmin().rpc("ecommerce_fail_payment_attempt", {
      p_attempt_id: attemptId, p_failure_code: code, p_failure_detail: detail, p_requires_review: true
    });
    if (!error) return;
  } catch {
    // Provider/database exceptions can contain PII; only fixed codes are logged.
  }
  console.error("payment_review_write_failed", { code: "payment_review_unavailable" });
  throw new InfinitePayError("Não foi possível registrar a revisão do pagamento com segurança.", "payment_review_unavailable", 503);
}

function isStoredLinkReference(attempt: VerificationAttempt) {
  if (!attempt.provider_checkout_id || !attempt.checkout_url) return false;
  try {
    const url = new URL(attempt.checkout_url);
    const linkReferences = url.searchParams.getAll("lenc");
    return url.origin === "https://checkout.infinitepay.io" && !url.username && !url.password &&
      linkReferences.length === 1 && linkReferences[0] === attempt.provider_checkout_id;
  } catch {
    return false;
  }
}

// Both entry points use the same financial decision and the installed atomic RPC.
export async function verifyInfinitePayPayment(
  attempt: VerificationAttempt,
  references: PaymentReferences
): Promise<PaymentVerificationResult> {
  // The existing RPC binds the stored link identifier. InfinitePay verifies the invoice slug.
  const usesLinkReference = isStoredLinkReference(attempt);
  if (attempt.provider_checkout_id && !usesLinkReference && attempt.provider_checkout_id !== references.invoiceSlug) {
    return { status: 409, body: { received: false, code: "provider_checkout_id_conflict" } };
  }
  if (attempt.transaction_nsu && attempt.transaction_nsu !== references.transactionNsu) {
    return { status: 409, body: { received: false, code: "transaction_nsu_conflict" } };
  }
  if (attempt.status === "paid" && !usesLinkReference) {
    if (attempt.order_id) await enqueuePaidEvent(attempt.order_id);
    return { status: 200, body: { received: true, code: "already_paid" } };
  }
  let paymentCheck: Awaited<ReturnType<typeof checkInfinitePayPayment>>;
  try { paymentCheck = await checkInfinitePayPayment(references); }
  catch (error) {
    if (error instanceof InfinitePayError) throw error;
    throw new InfinitePayError("Não foi possível consultar o pagamento neste momento.", "payment_provider_unavailable", 503);
  }
  const decision = evaluatePaymentAmounts(attempt.requested_amount_cents, paymentCheck);
  if (decision.status === "not_confirmed") {
    return { status: 400, body: { error: "O pagamento ainda não foi confirmado.", code: "payment_not_confirmed" } };
  }
  if (decision.status === "requires_review") {
    await markForReview(attempt.id, decision.code, decision.detail);
    return { status: 409, body: {
      error: decision.code === "payment_amount_mismatch"
        ? "O valor confirmado diverge do pedido." : "Este pagamento precisa ser conferido pela nossa equipe.",
      code: decision.code
    } };
  }
  let rpcResult: { data: unknown; error: unknown };
  try {
    rpcResult = await getSupabaseAdmin().rpc("ecommerce_confirm_payment", {
      p_order_nsu: references.orderNsu,
      p_provider_checkout_id: attempt.provider_checkout_id ?? references.invoiceSlug,
      p_transaction_nsu: references.transactionNsu,
      p_amount_cents: paymentCheck.amount,
      p_paid_amount_cents: paymentCheck.paid_amount,
      p_capture_method: paymentCheck.capture_method,
      p_installments: paymentCheck.installments,
      p_receipt_url: references.receiptUrl ?? null,
      p_payment_verified: true,
      p_check_success: paymentCheck.success,
      p_check_paid: paymentCheck.paid
    });
  } catch {
    throw new InfinitePayError("Não foi possível registrar a confirmação do pagamento.", "payment_confirmation_unavailable", 503);
  }
  const { data, error } = rpcResult;
  const confirmation = (Array.isArray(data) ? data[0] : data) as ConfirmationRow | null;
  if (error || !confirmation || typeof confirmation.result_code !== "string") {
    throw new InfinitePayError("Não foi possível registrar a confirmação do pagamento.", "payment_confirmation_unavailable", 503);
  }
  if (["paid", "already_paid", "order_already_paid"].includes(confirmation.result_code)) {
    if (confirmation.result_payment_status === "paid") await enqueuePaidEvent(confirmation.result_order_id);
    return { status: 200, body: { received: true, code: confirmation.result_code } };
  }
  return { status: confirmation.result_code.endsWith("conflict") ? 409 : 422,
    body: { received: false, code: confirmation.result_code } };
}
