import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureOrder } from "@/lib/orders/fixture";
import { parseOrderQuery } from "@/lib/orders/model";
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/admin/orders", () => ({ listAdminOrders: mocks.list, getAdminOrder: mocks.detail }));
vi.mock("@/app/admin/(protected)/pedidos/actions", () => ({ updateOrderStatusAction: "/synthetic-status-action", reconcilePaymentAction: "/synthetic-reconcile-action" }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));
import OrdersPage from "@/app/admin/(protected)/pedidos/page";
import OrderPage from "@/app/admin/(protected)/pedidos/[id]/page";

describe("páginas de pedidos renderizadas com snapshots sintéticos", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    mocks.list.mockResolvedValue({ orders: [fixtureOrder()], count: 21, query: parseOrderQuery({}), counts: [1, 2, 3, 4], pageSize: 20 });
    mocks.detail.mockResolvedValue(fixtureOrder());
  });
  it("renderiza listagem, cards, busca, filtros e próxima página", async () => {
    const html = renderToStaticMarkup(await OrdersPage({}));
    for (const text of ["MJ-000001", "Cliente de teste", "Ver pedido", "Novos / Pagos", "Em produção", "Prontos", "Enviados", 'name="q"', 'name="status"', "Próxima página", "Retirada na loja"]) expect(html).toContain(text);
    expect(html).toContain("page=2");
    expect(html).toContain("overflow-x-auto");
  });
  it("sem pedidos renderiza mensagem vazia, nao a tela de erro", async () => {
    mocks.list.mockResolvedValue({ orders: [], count: 0, query: parseOrderQuery({}), counts: [0, 0, 0, 0], pageSize: 20 });
    const html = renderToStaticMarkup(await OrdersPage({}));
    expect(html).toContain("Nenhum pedido encontrado.");
    expect(html).not.toContain("Não foi possível carregar");
  });
  it("preserva busca/filtro na navegação e apresenta página anterior", async () => {
    mocks.list.mockResolvedValue({ orders: [fixtureOrder()], count: 21, query: parseOrderQuery({ q: "Maria", status: "paid", page: "2" }), counts: [1, 0, 0, 0], pageSize: 20 });
    const html = renderToStaticMarkup(await OrdersPage({ searchParams: Promise.resolve({ q: "Maria", status: "paid", page: "2" }) }));
    expect(html).toContain("Página anterior"); expect(html).toContain("q=Maria"); expect(html).toContain("status=paid"); expect(html).toContain("page=1");
  });
  it("detalhe mostra snapshot, aros, gravações Unicode e contato", async () => {
    const html = renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ id: fixtureOrder().id }) }));
    for (const text of ["MJ-000001", "Alianças do pedido", "Aro: 17", "Aro: 21", "João ♥ Ana", "Sempre ∞", "Cliente de teste", "cliente@example.invalid", "CPF:", "Retirada na loja", "Falar com cliente no WhatsApp", 'name="expectedStatus"']) expect(html).toContain(text);
    expect(html).toContain("wa.me/5511999990000"); expect(html).not.toContain("rastreio");
  });
  it("pedido pendente não oferece pagamento manual e pickup não oferece envio", async () => {
    mocks.detail.mockResolvedValue(fixtureOrder({ payment_status: "pending", order_status: "pending_payment", paid_at: null }));
    const html = renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ id: fixtureOrder().id }) }));
    expect(html).not.toContain('<option value="paid"'); expect(html).not.toContain('<option value="preparing"'); expect(html).not.toContain('<option value="shipped"');
    expect(html).toContain('<option value="cancelled"');
    expect(html).toContain("Reconciliar pagamento");
    expect(html).toContain("/synthetic-reconcile-action");
  });
  it("renderiza entrega e referências reais do snapshot do pagamento", async () => {
    mocks.detail.mockResolvedValue(fixtureOrder({ delivery_method: "shipping", shipping_city: "Arujá", shipping_state: "SP", shipping_street: "Rua de teste", shipping_number: "10", shipping_carrier: "Jadlog", shipping_service: ".Package", shipping_cents: 2500,
      ecommerce_payment_attempts: [{ id: "attempt", provider: "infinitepay", order_nsu: "nsu-snapshot", provider_checkout_id: "checkout-snapshot", transaction_nsu: "transaction-snapshot", status: "paid", requested_amount_cents: 350000, paid_amount_cents: 350000, capture_method: "pix", installments: 1, confirmed_at: fixtureOrder().paid_at, created_at: fixtureOrder().created_at }] }));
    const html = renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ id: fixtureOrder().id }) }));
    for (const text of ["Arujá/SP", "Rua de teste, 10", "Jadlog", ".Package", "25,00", "nsu-snapshot", "checkout-snapshot", "transaction-snapshot"]) expect(html).toContain(text);
  });
  it("pedido inexistente não renderiza detalhe", async () => {
    mocks.detail.mockResolvedValue(null);
    await expect(OrderPage({ params: Promise.resolve({ id: fixtureOrder().id }) })).rejects.toThrow("not_found");
  });
  it("entrega mostra frete real, CEP, prazos e postagem manual sem oferecer retirada", async () => {
    mocks.detail.mockResolvedValue(fixtureOrder({ delivery_method: "shipping", shipping_carrier: "Correios",
      shipping_service: "SEDEX", shipping_cents: 2885, shipping_zip: "20040002", shipping_deadline_days: 2 }));
    const html = renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ id: fixtureOrder().id }) }));
    for (const text of ["Correios", "SEDEX", "28,85", "CEP 20040002", "Transporte estimado: 2 dias úteis",
      "Confecção: 3 a 5 dias úteis", "Postagem manual"]) expect(html).toContain(text);
    expect(html).not.toContain('<option value="ready_for_pickup"');
  });
  it("retirada não mostra postagem, transportadora ou prazo de transporte", async () => {
    const html = renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ id: fixtureOrder().id }) }));
    for (const text of ["Postagem manual", "SEDEX", "Transporte estimado:"]) expect(html).not.toContain(text);
  });
});
