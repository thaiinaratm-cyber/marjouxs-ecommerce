import { describe, expect, it } from "vitest";
import { buildGa4PurchasePayload, type Ga4OrderRow } from "@/lib/checkout/outbox";

describe("GA4 purchase payload", () => {
  it("envia somente dados comerciais, sem PII ou gravações", () => {
    const order = {
      id: "00000000-0000-4000-8000-000000000001",
      order_number: "MJ-000001",
      total_cents: 320000,
      shipping_cents: 0,
      ga_client_id: "123.456",
      ga_session_id: "1780000000",
      customer_name: "Não deve sair",
      ecommerce_order_items: [
        {
          product_id: "aliancas-em-ouro-18k-tradicional",
          product_name: "Alianças em Ouro 18k Tradicional",
          category: "Alianças",
          subcategory: "Alianças Ouro 18k",
          material: "Ouro 18k",
          unit_price_cents: 320000,
          quantity: 1,
          customization: { ring1: { engraving: "João ♥ Maria" } }
        }
      ]
    } as unknown as Ga4OrderRow;

    const serialized = JSON.stringify(buildGa4PurchasePayload(order));

    expect(serialized).toContain("MJ-000001");
    expect(serialized).not.toContain("Não deve sair");
    expect(serialized).not.toContain("João");
    expect(serialized).not.toContain("engraving");
  });
});
