import { describe, expect, it } from "vitest";
import { fixtureOrder } from "@/lib/orders/fixture";
import { canSetOrderStatus, customerWhatsapp, customizationLines, deliveryLines, money, orderDate, orderStatusLabels, parseOrderQuery } from "@/lib/orders/model";

describe("pedido: snapshot e apresentação", () => {
  it("preserva os nove status reais", () => expect(Object.keys(orderStatusLabels)).toHaveLength(9));
  it("formata centavos e fuso da loja", () => {
    expect(money(350000)).toMatch(/3\.500,00/);
    expect(orderDate("2026-10-17T12:00:00Z")).toContain("09:00");
  });
  it("retirada não mostra frete nem campos vazios", () => expect(deliveryLines(fixtureOrder())).toEqual(["Retirada na loja"]));
  it("entrega distingue transporte, confecção, cobrança e postagem manual", () => {
    const lines = deliveryLines(fixtureOrder({ delivery_method: "shipping", shipping_carrier: "Correios",
      shipping_service: "SEDEX", shipping_cents: 2885, shipping_zip: "20040002", shipping_deadline_days: 2 }));
    for (const value of ["Correios · SEDEX", "CEP 20040002", "Transporte estimado: 2 dias úteis",
      "Confecção: 3 a 5 dias úteis", "Postagem manual", "Status: Pago / Novo"]) expect(lines).toContain(value);
    expect(lines.join()).toContain("28,85");
    expect(deliveryLines(fixtureOrder({ delivery_method: "shipping", shipping_deadline_days: null })).join())
      .not.toContain("Transporte estimado");
  });
  it("pronto para retirada pertence somente à retirada, enviado somente à entrega", () => {
    expect(canSetOrderStatus(fixtureOrder({ delivery_method: "shipping" }), "ready_for_pickup")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder(), "ready_for_pickup")).toBe(true);
  });
  it("entrega preserva dados reais e frete", () => {
    const lines = deliveryLines(fixtureOrder({ delivery_method: "shipping", shipping_city: "Arujá", shipping_state: "SP", shipping_carrier: "Jadlog", shipping_service: ".Package", shipping_cents: 1990 }));
    expect(lines).toContain("Arujá/SP"); expect(lines).toContain("Jadlog · .Package"); expect(lines.join()).toContain("19,90");
    expect(lines).not.toContain("");
  });
  it("alianças usam dois aros e gravação Unicode do snapshot", () => {
    const lines = customizationLines(fixtureOrder().ecommerce_order_items[0]);
    expect(lines.join()).toContain("Aro: 17"); expect(lines.join()).toContain("Aro: 21");
    expect(lines.join()).toContain("João ♥ Ana"); expect(lines.join()).toContain("Sempre ∞");
  });
  it("não inventa gravação vazia nem campos de aliança em produto normal", () => {
    expect(customizationLines({ category: "Brincos", customization: fixtureOrder().ecommerce_order_items[0].customization })).toEqual([]);
    expect(customizationLines({ category: "Brincos", customization: null })).toEqual([]);
  });
  it("não permite confirmar pagamento pelo status operacional", () => {
    expect(canSetOrderStatus(fixtureOrder({ payment_status: "pending" }), "paid")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder({ payment_status: "pending" }), "preparing")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder(), "preparing")).toBe(true);
    expect(canSetOrderStatus(fixtureOrder(), "pending_payment")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder(), "shipped")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder({ delivery_method: "shipping" }), "shipped")).toBe(true);
  });
  it("monta WhatsApp do cliente sem enviar automaticamente", () => {
    const url = customerWhatsapp(fixtureOrder());
    expect(url).toContain("wa.me/5511999990000"); expect(decodeURIComponent(url!)).toContain("pedido #MJ-000001");
    expect(customerWhatsapp(fixtureOrder({ customer_phone: "inválido" }))).toBeNull();
  });
  it("permite progresso operacional e bloqueia regressao ou reabertura", () => {
    expect(canSetOrderStatus(fixtureOrder({ order_status: "preparing" }), "ready_for_pickup")).toBe(true);
    expect(canSetOrderStatus(fixtureOrder({ order_status: "preparing" }), "paid")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder({ order_status: "ready_for_pickup", delivery_method: "shipping" }), "shipped")).toBe(true);
    expect(canSetOrderStatus(fixtureOrder({ order_status: "ready_for_pickup" }), "completed")).toBe(true);
    expect(canSetOrderStatus(fixtureOrder({ order_status: "completed" }), "preparing")).toBe(false);
    expect(canSetOrderStatus(fixtureOrder({ order_status: "cancelled" }), "paid")).toBe(false);
  });
  it("normaliza busca, filtra somente status reais e pagina de 20 em 20", () => {
    expect(parseOrderQuery({ q: "  Ana (teste),% ", status: "preparing", page: "2" })).toEqual({ search: "Ana teste", status: "preparing", page: 2, from: 20, to: 39 });
    expect(parseOrderQuery({ status: "in_production", page: "-2" })).toMatchObject({ status: "", page: 1 });
  });
});
