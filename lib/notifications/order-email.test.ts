import { describe, expect, it } from "vitest";
import { fixtureOrder } from "@/lib/orders/fixture";
import { buildOrderPaidEmail, getOrderNotificationConfig, orderNotificationsEnabled, orderEmailSnapshotSchema } from "@/lib/notifications/order-email";
const config = { from: "Marjouxs <loja@example.invalid>", to: ["equipe@example.invalid"], siteUrl: "https://marjouxsjoias.com.br" };
describe("email order.paid sem envio real", () => {
  it("desabilitado por padrão, sem exigir secrets no desenvolvimento", () => {
    expect(orderNotificationsEnabled({})).toBe(false); expect(getOrderNotificationConfig({})).toBeNull();
  });
  it("aceita múltiplos destinatários e reutiliza NEXT_PUBLIC_SITE_URL", () => {
    const result = getOrderNotificationConfig({ ORDER_NOTIFICATIONS_ENABLED: "true", RESEND_API_KEY: "fake-key", ORDER_NOTIFICATION_EMAIL: "a@example.invalid,b@example.invalid;a@example.invalid", ORDER_NOTIFICATION_FROM: config.from, NEXT_PUBLIC_SITE_URL: config.siteUrl });
    expect(result?.to).toHaveLength(2); expect(result?.siteUrl).toBe(config.siteUrl);
  });
  it("rejeita configuração inválida e localhost em produção", () => {
    expect(() => getOrderNotificationConfig({ ORDER_NOTIFICATIONS_ENABLED: "true" })).toThrow("notification_configuration_invalid");
    expect(() => getOrderNotificationConfig({ ORDER_NOTIFICATIONS_ENABLED: "true", RESEND_API_KEY: "fake", ORDER_NOTIFICATION_EMAIL: "a@example.invalid", ORDER_NOTIFICATION_FROM: config.from, NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NODE_ENV: "production" })).toThrow("notification_site_url_invalid");
  });
  it("não renderiza venda para pedido pendente", () => expect(() => buildOrderPaidEmail(fixtureOrder({ payment_status: "pending" }), config)).toThrow("notification_order_not_paid"));
  it("HTML e texto preservam aros, Unicode e omitem CPF e campos vazios", () => {
    const message = buildOrderPaidEmail(fixtureOrder(), config);
    expect(message.subject).toBe("Nova venda paga — Pedido #MJ-000001 — Marjouxs");
    for (const rendered of [message.text, message.html]) {
      expect(rendered).toContain("João ♥ Ana"); expect(rendered).toContain("Sempre ∞"); expect(rendered).toContain("Aro: 17");
      expect(rendered).toContain("Retirada na loja"); expect(rendered).not.toContain("CPF"); expect(rendered).not.toContain("Frete:");
      expect(rendered).toContain("/admin/pedidos/11111111-1111-4111-8111-111111111111");
    }
  });
  it("entrega inclui cidade, transportadora e frete; não inventa rastreio", () => {
    const text = buildOrderPaidEmail(fixtureOrder({ delivery_method: "shipping", shipping_city: "Arujá", shipping_state: "SP", shipping_carrier: "Jadlog", shipping_service: ".Com", shipping_cents: 2500 }), config).text;
    expect(text).toContain("Arujá/SP"); expect(text).toContain("Jadlog · .Com"); expect(text).toContain("25,00"); expect(text).not.toContain("rastreio");
  });
  it("escapa HTML vindo do cliente e não consulta catálogo", () => {
    const message = buildOrderPaidEmail(fixtureOrder({ customer_name: '<img src=x onerror="alert(1)">' }), config);
    expect(message.html).not.toContain("<img"); expect(message.html).toContain("&lt;img"); expect(message.text).toContain("<img");
    expect(message.text).toContain("Alianças do pedido");
  });
  it("HTML e texto usam snapshot de entrega e não incluem CPF/secrets/payload bruto", () => {
    const order = fixtureOrder({ delivery_method: "shipping", shipping_carrier: "Correios", shipping_service: "SEDEX",
      shipping_zip: "20040002", shipping_deadline_days: 2, shipping_cents: 2885 });
    const snapshot = orderEmailSnapshotSchema.parse({ ...order, access_token: "fixture-secret",
      client_secret: "fixture-secret", RESEND_API_KEY: "fixture-secret" });
    const message = buildOrderPaidEmail(snapshot, config);
    for (const rendered of [message.html, message.text]) {
      for (const value of ["Correios", "SEDEX", "CEP 20040002", "28,85", "Transporte estimado: 2 dias úteis",
        "Confecção: 3 a 5 dias úteis", "Postagem manual"]) expect(rendered).toContain(value);
      for (const value of ["CPF", order.customer_cpf!, "fixture-secret", "access_token", "client_secret", "RESEND_API_KEY", "melhor_envio"])
        expect(rendered).not.toContain(value);
    }
    expect(snapshot).not.toHaveProperty("customer_cpf");
    expect(snapshot).not.toHaveProperty("access_token");
  });
  it("snapshots antigos sem CEP/prazo continuam válidos, sem inventar dados", () => {
    const snapshot = orderEmailSnapshotSchema.parse(fixtureOrder({ delivery_method: "shipping" }));
    expect(snapshot.shipping_zip).toBeNull();
    expect(snapshot.shipping_deadline_days).toBeNull();
    const text = buildOrderPaidEmail(snapshot, config).text;
    expect(text).not.toContain("CEP ");
    expect(text).not.toContain("Transporte estimado");
  });
});
