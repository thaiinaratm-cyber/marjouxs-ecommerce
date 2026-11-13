import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { confirmationSupportUrl, parseConfirmationOrder } from "@/lib/checkout/confirmation";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";

describe("confirmation public contract and support privacy", () => {
  it("projects only public fields, including when a response unexpectedly contains PII", () => {
    const fixture = confirmationFixture();
    const parsed = parseConfirmationOrder({ ...fixture, customer_name: "Private Person", customer_email: "private@example.invalid",
      customer_cpf: "private-cpf", transaction_nsu: "private-transaction", id: "private-id", request_metadata: "private-payload",
      shippingAddress: { street: "Private Address" }, receiptUrl: "https://example.invalid/private-receipt", trackingCode: "private-tracking",
      items: [{ ...fixture.items[0], customization: { engraving: "private-engraving" }, internal_id: "private-item" }] });
    expect(parsed).toMatchObject({ shippingAddress: null, receiptUrl: null, trackingCode: null });
    expect(parsed?.items[0].customization).toBeNull(); expect(JSON.stringify(parsed)).not.toMatch(/private-|Private|customer_/);
  });
  it.each([{}, { paymentStatus: "paid" }, { ...confirmationFixture(), totalCents: "16000" },
    { ...confirmationFixture(), paymentStatus: "paid", paidAt: null }, { ...confirmationFixture(), paymentStatus: "expired" }])
    ("rejects malformed or invented financial states", payload => expect(parseConfirmationOrder(payload)).toBeNull());
  it.each(["paid", "pending", "requires_review", "failed"] as const)("%s support sends only reference and a generic status", paymentStatus => {
    const url = new URL(confirmationSupportUrl(confirmationFixture({ paymentStatus })));
    expect(url.pathname).toBe("/5511919964393");
    expect(url.searchParams.get("text")).toMatch(/^Pedido: MJ-000123\.\nStatus: [^\n]+\.$/);
    expect(url.searchParams.get("text")).not.toMatch(/token|nsu|160|cpf|email|failed|requires_review/);
  });
  it("invalid references are omitted from the support message", () => {
    expect(new URL(confirmationSupportUrl(confirmationFixture({ orderNumber: "private@example.invalid" }))).searchParams.get("text"))
      .toBe("Status: aguardando confirmação.");
    expect(new URL(confirmationSupportUrl(null)).searchParams.get("text")).toBe("Status: consulta de pedido indisponível.");
  });
  it("confirmation observes status but never imports financial writers or client-side GA4 purchase", () => {
    const sources = ["components/order-confirmation.tsx", "lib/checkout/confirmation-polling.ts"].map(path => readFileSync(path, "utf8")).join("\n");
    expect(sources).not.toMatch(/api\/payments|createCheckout|processEcommerceOutbox|ensurePaidOrderEvent|verifyInfinitePayPayment|trackPurchase\(/);
    expect(sources).toContain("trackGoogleAdsPurchaseWhenReady");
  });
});
