import { describe, expect, it } from "vitest";
import { canReconcileAttempt, checkoutRecoveryState, OLD_PENDING_MS, pendingAge } from "@/lib/checkout/payment-state";
const order = { payment_status: "pending", order_status: "pending_payment" };
describe("recovery classification, not a second state machine", () => {
  it("no attempt and pending without link fail closed", () => {
    expect(checkoutRecoveryState(order, null)).toBe("blocked");
    expect(checkoutRecoveryState(order, { status: "pending" })).toBe("blocked");
    expect(checkoutRecoveryState(order, { status: "pending", checkout_url: "javascript:alert(1)", provider_checkout_id: "qa" })).toBe("blocked");
  });
  it("pending links are reused regardless of age; age does not prove provider expiry", () => {
    expect(checkoutRecoveryState(order, { status: "pending", checkout_url: "https://example.invalid/qa", provider_checkout_id: "qa" })).toBe("pending");
    expect(pendingAge("2026-01-01T00:00:00Z", Date.parse("2026-11-04T00:00:00Z"))).toBe("old");
  });
  it.each(["unclaimed", "reserved"])("%s permits only installed pre-dispatch recovery", state => {
    expect(checkoutRecoveryState(order, { status: "creating", request_metadata: { checkout_link_dispatch: { version: 1, state } } })).toBe("pre_dispatch");
  });
  it("dispatch unknown and legacy never imply unclaimed", () => {
    expect(checkoutRecoveryState(order, { status: "creating", request_metadata: {} })).toBe("legacy");
    expect(checkoutRecoveryState(order, { status: "creating", request_metadata: { checkout_link_dispatch: { version: 1, state: "dispatched" } } })).toBe("dispatch_unknown");
    expect(checkoutRecoveryState(order, { status: "creating", request_metadata: { checkout_link_dispatch: null } })).toBe("blocked");
  });
  it.each(["failed", "requires_review", "paid"])("%s remains blocked/terminal without generating a new attempt", status => {
    expect(checkoutRecoveryState({ ...order, payment_status: status }, { status })).toBe(status);
  });
  it("paid is terminal even with stale review/cancelled data", () => {
    expect(checkoutRecoveryState({ payment_status: "paid", order_status: "cancelled" }, { status: "requires_review" })).toBe("paid");
  });
  it("age threshold is only logical and rejects invalid/future dates", () => {
    expect(pendingAge(new Date(1000).toISOString(), 1000 + OLD_PENDING_MS - 1)).toBe("recent");
    expect(pendingAge(new Date(1000).toISOString(), 1000 + OLD_PENDING_MS)).toBe("old");
    expect(pendingAge("invalid")).toBe("unknown"); expect(pendingAge(new Date(2000).toISOString(), 1000)).toBe("unknown");
  });
  it("review can only be checked again with known financial reasons, never identifier conflicts", () => {
    expect(canReconcileAttempt("requires_review", { status: "requires_review", failure_code: "payment_amount_mismatch" })).toBe(true);
    for (const failure_code of [null, "provider_identifier_conflict", "transaction_nsu_conflict", "unknown"]) {
      expect(canReconcileAttempt("requires_review", { status: "requires_review", failure_code })).toBe(false);
    }
    expect(canReconcileAttempt("failed", { status: "failed" })).toBe(false);
  });
});
