type ReviewCode =
  | "payment_expected_amount_invalid"
  | "payment_amount_mismatch"
  | "payment_paid_amount_invalid"
  | "payment_method_invalid"
  | "payment_installments_invalid"
  | "payment_pix_discount_unverified"
  | "payment_paid_amount_mismatch";

export type PaymentAmountDecision =
  | { status: "confirm" }
  | { status: "not_confirmed" }
  | { status: "requires_review"; code: ReviewCode; detail: string };

const reviewDetails: Record<ReviewCode, string> = {
  payment_expected_amount_invalid: "Stored requested amount is not a positive safe integer in cents",
  payment_amount_mismatch: "Official payment_check amount differs from the requested amount",
  payment_paid_amount_invalid: "Official paid_amount is not a positive safe integer in cents",
  payment_method_invalid: "Official capture_method is unsupported",
  payment_installments_invalid: "Official installments are incompatible with the payment method",
  payment_pix_discount_unverified: "Pix discount and rounding are not verified for this payment",
  payment_paid_amount_mismatch: "Official paid_amount differs without a verified discount or fee rule"
};

function positiveCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function storedCents(value: unknown) {
  const cents = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  return positiveCents(cents) ? cents : null;
}

function review(code: ReviewCode): PaymentAmountDecision {
  return { status: "requires_review", code, detail: reviewDetails[code] };
}

// This authorizes the confirmation call, not the payment itself; SQL remains the final authority.
export function evaluatePaymentAmounts(expectedAmountCents: unknown, verifiedResponse: unknown): PaymentAmountDecision {
  const check = verifiedResponse && typeof verifiedResponse === "object"
    ? verifiedResponse as Record<string, unknown> : {};
  if (check.success !== true || check.paid !== true) return { status: "not_confirmed" };

  const expected = storedCents(expectedAmountCents);
  if (expected === null) return review("payment_expected_amount_invalid");
  if (!positiveCents(check.amount) || check.amount !== expected) return review("payment_amount_mismatch");
  if (!positiveCents(check.paid_amount)) return review("payment_paid_amount_invalid");
  if (check.capture_method !== "pix" && check.capture_method !== "credit_card") return review("payment_method_invalid");
  if (
    typeof check.installments !== "number" || !Number.isSafeInteger(check.installments) ||
    check.installments < 1 || check.installments > 12 ||
    (check.capture_method === "pix" && check.installments !== 1)
  ) return review("payment_installments_invalid");

  // The provider allows configurable discounts/fees but does not prove their exact rule here.
  // Do not turn the product-page marketing percentage into payment authorization.
  if (check.paid_amount !== expected) {
    return review(check.capture_method === "pix" && check.paid_amount < expected
      ? "payment_pix_discount_unverified" : "payment_paid_amount_mismatch");
  }
  return { status: "confirm" };
}
