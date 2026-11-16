import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/context/cart-context", () => ({ useCart: () => ({}) }));
import { getConfirmationCopy, OrderConfirmation, OrderConfirmationView } from "@/components/order-confirmation";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";
import { parseConfirmationOrder } from "@/lib/checkout/confirmation";
import type { ConfirmationState } from "@/lib/checkout/confirmation-polling";
import type { PublicOrder } from "@/types/checkout";
describe("customer confirmation copy", () => {
  it.each([
    ["paid", "Pagamento aprovado"], ["pending", "Aguardando confirmação"],
    ["requires_review", "Seu pagamento está em verificação"], ["failed", "Não foi possível confirmar este pagamento"]
  ] as const)("%s is described without inventing a refusal or expiry", (paymentStatus, title) => {
    const copy = getConfirmationCopy({ paymentStatus } as PublicOrder);
    expect(copy.title).toBe(title); expect(copy.text).not.toMatch(/recusado|expirado|transaction_nsu|RPC/);
  });
});

describe("post-payment confirmation HTML", () => {
  beforeEach(() => { vi.stubGlobal("React", React); });
  afterEach(() => vi.unstubAllGlobals());
  function render(state: ConfirmationState) {
    return renderToStaticMarkup(<OrderConfirmationView state={state} onRetry={() => {}} />);
  }
  it("loading is visible and never pretends payment was confirmed", () => {
    const html = renderToStaticMarkup(<OrderConfirmation token="invalid" />);
    expect(html).toContain("Consultando seu pedido"); expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Pagamento aprovado"); expect(html).not.toContain("Ir para o pagamento");
  });
  it.each(["paid", "pending", "requires_review", "failed"] as const)("%s has clear status, order reference and total", paymentStatus => {
    const order = confirmationFixture({ paymentStatus, paidAt: paymentStatus === "paid" ? "2026-11-04T12:01:00Z" : null });
    const html = render({ phase: "ready", order, refreshing: false });
    expect(html).toContain(getConfirmationCopy(order).title); expect(html).toContain("MJ-000123");
    expect(html).toContain("160,00"); expect(html).toContain("Retirada na loja");
    expect(html).toContain('aria-live="polite"'); expect(html).toContain('tabindex="-1"');
    expect(html).not.toMatch(/Ir para o pagamento|transaction_nsu|provider_checkout_id|checkout_url/);
  });
  it("paid explains next steps and production time without a new payment CTA", () => {
    const html = render({ phase: "ready", order: confirmationFixture({ paymentStatus: "paid", paidAt: "2026-11-04T12:01:00Z" }), refreshing: false });
    expect(html).toContain("3 a 5 dias úteis"); expect(html).toContain("Acompanhar meu pedido");
    expect(html).toContain('href="#andamento-do-pedido"');
    expect(html).not.toContain("Consultar novamente"); expect(html).not.toContain("Falar com a Marjouxs");
  });
  it.each(["requires_review", "failed"] as const)("%s offers support and return, without new checkout", paymentStatus => {
    const html = render({ phase: "ready", order: confirmationFixture({ paymentStatus }), refreshing: false });
    expect(html).toContain("Nenhuma nova cobrança será iniciada automaticamente");
    expect(html).toContain("Falar com a Marjouxs"); expect(html).toContain("Voltar à loja");
    expect(html).toContain("wa.me/5511919964393"); expect(html).not.toContain("Consultar novamente");
  });
  it("long pending offers support and a read-only retry, without declaring expiry or failed", () => {
    const html = render({ phase: "pending_timeout", order: confirmationFixture(), refreshing: false });
    expect(html).toContain("Você não precisa pagar novamente"); expect(html).toContain("Consultar novamente");
    expect(html).toContain("wa.me/5511919964393"); expect(html).not.toMatch(/pagamento recusado|pagamento expirado|Pagamento aprovado/);
  });
  it.each(["invalid", "temporary_error"] as const)("%s is generic and never reveals a customer or a paid claim", phase => {
    const html = render({ phase, order: null, refreshing: false });
    expect(html).toContain("Falar com a Marjouxs"); expect(html).not.toContain("MJ-000123");
    expect(html).not.toContain("Pagamento aprovado");
    expect(html.includes("Consultar novamente")).toBe(phase === "temporary_error");
  });
  it("a temporary read error preserves the last pending state and explains stale information", () => {
    const html = render({ phase: "temporary_error", order: confirmationFixture(), refreshing: false });
    expect(html).toContain("Aguardando confirmação"); expect(html).toContain("última consulta");
    expect(html).not.toContain("Não foi possível confirmar este pagamento");
  });
  it("shipping is useful without showing a missing-address technical message", () => {
    const order = confirmationFixture({ deliveryMethod: "shipping", shippingCarrier: "Correios", shippingService: "SEDEX", shippingDeadlineDays: 2 });
    const html = render({ phase: "ready", order, refreshing: false });
    expect(html).toContain("Correios"); expect(html).toContain("SEDEX"); expect(html).toContain("2 dias");
    expect(html).not.toContain("O endereço não está disponível");
  });
  it("the allowlisted response cannot render private injected properties", () => {
    const order = parseConfirmationOrder({ ...confirmationFixture(), customerEmail: "private@example.invalid",
      transaction_nsu: "private-transaction", provider_checkout_id: "private-provider", receiptUrl: "https://example.invalid/private-receipt",
      shippingAddress: { street: "Private address" } })!;
    const html = render({ phase: "ready", order, refreshing: false });
    expect(html).not.toMatch(/private@example|private-transaction|private-provider|private-receipt|Private address/);
  });
});
