import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderMaybeSingle: vi.fn(),
  paymentMaybeSingle: vi.fn(),
  orderEq: vi.fn(),
  paymentEq: vi.fn()
}));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "ecommerce_orders") {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              mocks.orderEq(field, value);
              return { maybeSingle: mocks.orderMaybeSingle };
            }
          })
        };
      }

      return {
        select: () => ({
          eq: (field: string, value: string) => {
            mocks.paymentEq(field, value);
            return {
              order: () => ({
                limit: () => ({ maybeSingle: mocks.paymentMaybeSingle })
              })
            };
          }
        })
      };
    }
  })
}));

import { getPublicOrderByCustomer } from "@/lib/checkout/orders";

const orderRow = {
  id: "00000000-0000-4000-8000-000000000001",
  order_number: "MJ-000123",
  created_at: "2026-09-14T12:00:00.000Z",
  customer_email: "Cliente@Example.com",
  payment_status: "paid",
  order_status: "pending_payment",
  delivery_method: "shipping",
  shipping_zip: "07400610",
  shipping_street: "Avenida João Manoel",
  shipping_number: "600",
  shipping_complement: "Térreo",
  shipping_neighborhood: "Centro",
  shipping_city: "Arujá",
  shipping_state: "SP",
  shipping_carrier: "Jadlog",
  shipping_service: ".Package",
  shipping_deadline_days: 4,
  subtotal_cents: 10000,
  shipping_cents: 2000,
  discount_cents: 0,
  total_cents: 12000,
  paid_at: "2026-09-14T12:05:00.000Z",
  ecommerce_order_items: [
    {
      id: "item-1",
      line_number: 1,
      product_slug: "alianca-ouro",
      product_name: "Aliança Ouro 18k",
      product_image: "/produtos/alianca-ouro.webp",
      category: "Alianças",
      material: "Ouro 18k",
      unit_price_cents: 10000,
      quantity: 1,
      subtotal_cents: 10000,
      customization: {
        type: "ring_pair",
        ring1: { size: 18, engraving: "João" },
        ring2: { size: 16, engraving: null }
      }
    }
  ]
};

describe("getPublicOrderByCustomer", () => {
  beforeEach(() => {
    mocks.orderMaybeSingle.mockReset();
    mocks.paymentMaybeSingle.mockReset();
    mocks.orderEq.mockReset();
    mocks.paymentEq.mockReset();
    mocks.orderMaybeSingle.mockResolvedValue({ data: orderRow, error: null });
    mocks.paymentMaybeSingle.mockResolvedValue({
      data: {
        capture_method: "pix",
        installments: 1,
        receipt_url: null,
        status: "paid",
        created_at: "2026-09-14T12:05:00.000Z"
      },
      error: null
    });
  });

  it("valida o e-mail sem diferenciar maiúsculas e nunca o devolve", async () => {
    const order = await getPublicOrderByCustomer("MJ-000123", "cliente@example.com");

    expect(mocks.orderEq).toHaveBeenCalledWith("order_number", "MJ-000123");
    expect(mocks.paymentMaybeSingle).toHaveBeenCalledOnce();
    expect(order).toMatchObject({
      orderNumber: "MJ-000123",
      statusStage: "payment_approved",
      deliveryMethod: "shipping",
      shippingAddress: {
        street: "Avenida João Manoel",
        number: "600",
        city: "Arujá"
      },
      trackingCode: null
    });
    expect(JSON.stringify(order)).not.toContain("Cliente@Example.com");
    expect(JSON.stringify(order)).not.toContain(orderRow.id);
  });

  it("não consulta o pagamento nem expõe o pedido quando o e-mail diverge", async () => {
    const order = await getPublicOrderByCustomer("MJ-000123", "outro@example.com");

    expect(order).toBeNull();
    expect(mocks.paymentMaybeSingle).not.toHaveBeenCalled();
  });

  it("retorna ausência genérica quando o número não existe", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      getPublicOrderByCustomer("MJ-999999", "cliente@example.com")
    ).resolves.toBeNull();
    expect(mocks.paymentMaybeSingle).not.toHaveBeenCalled();
  });
});
