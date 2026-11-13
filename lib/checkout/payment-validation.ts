type ReviewCode =
  | "payment_expected_amount_invalid"
  | "payment_amount_mismatch"
  | "payment_paid_amount_invalid"
  | "payment_method_invalid"
  | "payment_installments_invalid";

export type PaymentAmountDecision =
  | { status: "confirm" }
  | { status: "not_confirmed" }
  | { status: "requires_review"; code: ReviewCode; detail: string };

const reviewDetails: Record<ReviewCode, string> = {
  payment_expected_amount_invalid: "Stored requested amount is not a positive safe integer in cents",
  payment_amount_mismatch: "Official payment_check amount differs from the requested amount",
  payment_paid_amount_invalid: "Official paid_amount is not a positive safe integer in cents",
  payment_method_invalid: "Official capture_method is unsupported",
  payment_installments_invalid: "Official installments are incompatible with the payment method"
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

  // The original charge must match the order. The provider reports what was actually paid.
  return { status: "confirm" };
}
