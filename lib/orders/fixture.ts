import type { OrderSnapshot } from "@/lib/orders/model";

// Synthetic data for automated tests and local template preview only.
export function fixtureOrder(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: "11111111-1111-4111-8111-111111111111", order_number: "MJ-000001",
    created_at: "2026-10-17T12:00:00Z", updated_at: "2026-10-17T12:00:00Z",
    customer_name: "Cliente de teste", customer_email: "cliente@example.invalid",
    customer_phone: "11999990000", customer_cpf: "CPF-NAO-INCLUIR-NO-EMAIL",
    total_cents: 350000, subtotal_cents: 350000, shipping_cents: 0, discount_cents: 0,
    payment_status: "paid", order_status: "paid", payment_provider: "infinitepay",
    payment_method: "pix", paid_at: "2026-10-17T12:05:00Z", delivery_method: "pickup",
    shipping_carrier: null, shipping_service: null, shipping_provider: null,
    shipping_zip: null, shipping_street: null, shipping_number: null, shipping_complement: null,
    shipping_neighborhood: null, shipping_city: null, shipping_state: null,
    ecommerce_payment_attempts: [],
    ecommerce_order_items: [{ id: "item1", line_number: 1, product_id: "legacy-snapshot",
      product_slug: "alianca-snapshot", product_name: "Alianças do pedido", product_image: "/produtos/modelo.webp",
      category: "Alianças", subcategory: "Ouro 18k", material: "Ouro 18k", availability: "made_to_order",
      unit_price_cents: 350000, quantity: 1, subtotal_cents: 350000,
      customization: { type: "ring_pair", ring1: { size: 17, engraving: "João ♥ Ana" }, ring2: { size: 21, engraving: "Sempre ∞" } } }],
    ...overrides
  };
}
