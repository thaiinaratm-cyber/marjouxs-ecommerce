// Presentation/recovery policy only. Installed RPCs remain the transition authority.
export const OLD_PENDING_MS = 24 * 60 * 60 * 1000;
export type RecoveryState = "new" | "paid" | "pending" | "pre_dispatch" | "requires_review" |
  "failed" | "cancelled" | "blocked" | "legacy" | "dispatch_unknown";
export function checkoutRecoveryState(
  order: { payment_status: string; order_status: string },
  attempt: { status: string; checkout_url?: string | null; provider_checkout_id?: string | null; request_metadata?: unknown } | null
): RecoveryState {
  if (order.payment_status === "paid" || attempt?.status === "paid") return "paid";
  if (order.payment_status === "requires_review" || attempt?.status === "requires_review") return "requires_review";
  if (order.order_status === "cancelled") return "cancelled";
  if (order.payment_status === "failed" || attempt?.status === "failed") return "failed";
  if (order.payment_status !== "pending" || order.order_status !== "pending_payment" || !attempt) return "blocked";
  if (attempt.status === "pending") {
    try {
      if (new URL(attempt.checkout_url ?? "").protocol === "https:" && attempt.provider_checkout_id?.trim()) return "pending";
    } catch { /* Missing links require manual review, not another dispatch. */ }
    return "blocked";
  }
  if (attempt.status !== "creating") return "blocked";
  const metadata = attempt.request_metadata as { checkout_link_dispatch?: { version?: unknown; state?: unknown } } | null;
  const dispatch = metadata?.checkout_link_dispatch;
  if (dispatch === undefined) return "legacy";
  if (!dispatch || dispatch.version !== 1) return "blocked";
  if (dispatch.state === "dispatched") return "dispatch_unknown";
  return dispatch.state === "unclaimed" || dispatch.state === "reserved" ? "pre_dispatch" : "blocked";
}

export function pendingAge(createdAt: string, now = Date.now()) {
  const created = Date.parse(createdAt);
  return !Number.isFinite(created) || created > now ? "unknown" : now - created >= OLD_PENDING_MS ? "old" : "recent";
}

// Never re-check identifier conflicts automatically, even from the authenticated admin.
export const RECHECKABLE_REVIEW_CODES = ["payment_amount_mismatch", "payment_paid_amount_mismatch",
  "payment_paid_amount_invalid", "payment_method_invalid", "payment_installments_invalid", "payment_pix_discount_unverified"];
export function canReconcileAttempt(paymentStatus: string, attempt: { status: string; failure_code?: string | null }) {
  return (paymentStatus === "pending" && attempt.status === "pending") ||
    (paymentStatus === "requires_review" && attempt.status === "requires_review" &&
      RECHECKABLE_REVIEW_CODES.includes(attempt.failure_code ?? ""));
}

export function paymentReviewReason(code?: string | null) {
  const reasons: Record<string, string> = {
    payment_amount_mismatch: "Valor oficial diferente do valor solicitado.",
    payment_paid_amount_mismatch: "Valor recebido precisa de conferência.",
    payment_paid_amount_invalid: "Valor recebido inválido na consulta oficial.",
    payment_method_invalid: "Meio de pagamento não reconhecido.",
    payment_installments_invalid: "Parcelamento precisa de conferência.",
    payment_pix_discount_unverified: "Regra do desconto Pix não comprovada pela consulta oficial.",
    payment_expected_amount_invalid: "Valor solicitado inválido; exige revisão técnica.",
    provider_identifier_conflict: "Conflito de referência do provedor; exige revisão manual.",
    provider_checkout_id_conflict: "Conflito de checkout; exige revisão manual.",
    transaction_nsu_conflict: "Conflito de transação; exige revisão manual.",
    payment_provider_error: "Criação do link rejeitada pelo provedor. Não repetir automaticamente."
  };
  return code && Object.hasOwn(reasons, code) ? `${reasons[code]} (${code})` : "Motivo não classificado. Conferência manual necessária.";
}
