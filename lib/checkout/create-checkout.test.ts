import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  createProviderCheckout: vi.fn(),
  quoteShipping: vi.fn()
}));

vi.mock("@/lib/checkout/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc, from: mocks.from })
}));

vi.mock("@/lib/checkout/shipping", () => ({
  quoteShipping: mocks.quoteShipping
}));

vi.mock("@/lib/checkout/infinitepay", async (original) => ({
  ...await original<typeof import("@/lib/checkout/infinitepay")>(),
  prepareInfinitePayCheckout: (input: unknown) => () => mocks.createProviderCheckout(input)
}));

import { createCheckout } from "@/lib/checkout/create-checkout";
import { createCheckoutSchema } from "@/lib/checkout/schemas";

const request = {
  requestId: "3f2a90a7-712f-4bc7-ac3a-536227af01a0",
  items: [
    {
      productId: "brinco-ponto-de-luz",
      productSlug: "brinco-ponto-de-luz",
      quantity: 1,
      customization: null
    }
  ],
  customer: {
    name: "Cliente Teste",
    phone: "11999999999",
    email: "cliente@example.com",
    cpf: ""
  },
  delivery: { method: "pickup" as const }
};

const originalCatalogSource = process.env.CHECKOUT_CATALOG_SOURCE;
let rpcTotalCents = 17990;

function useDatabaseProduct(isActive = true, price = "160.00") {
  const productId = "00000000-0000-4000-8000-000000000101";
  const rows: Record<string, unknown[]> = {
    ecommerce_products: [{
      id: productId,
      legacy_id: "brinco-ponto-de-luz",
      name: "Brinco Ponto de Luz",
      slug: "brinco-ponto-de-luz",
      category_id: "category-1",
      subcategory_id: "subcategory-1",
      material_id: "material-1",
      price,
      stock_status: "available",
      sale_unit: "unit",
      is_active: isActive,
      engraving_available: false,
      size_min: null,
      size_max: null
    }],
    ecommerce_categories: [{ id: "category-1", name: "Brincos", is_active: true }],
    ecommerce_subcategories: [{ id: "subcategory-1", category_id: "category-1", name: "Ouro 18k", is_active: true }],
    ecommerce_materials: [{ id: "material-1", name: "Ouro 18k", is_active: true }],
    ecommerce_product_images: [{
      product_id: productId,
      path: "/produtos/brinco-ponto-de-luz.jpg",
      source_type: "local",
      is_primary: true
    }]
  };
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      in: () => ({
        eq: () => ({ abortSignal: async () => ({ data: rows[table], error: null }) }),
        abortSignal: async () => ({ data: rows[table], error: null })
      })
    })
  }));
  process.env.CHECKOUT_CATALOG_SOURCE = "database";
}

describe("createCheckout", () => {
  beforeEach(() => {
    rpcTotalCents = 17990;
    process.env.CHECKOUT_CATALOG_SOURCE = "static";
    vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.createProviderCheckout.mockResolvedValue({
      checkoutUrl: "https://checkout.infinitepay.com.br/marjouxs?lenc=fatura-1",
      providerCheckoutId: "fatura-1"
    });
    mocks.rpc.mockImplementation(async (operation: string, args: Record<string, unknown>) => {
      if (operation === "ecommerce_create_checkout") {
        return {
          data: [
            {
              result_order_id: "00000000-0000-4000-8000-000000000001",
              result_order_number: "MJ-000001",
              result_public_token: "00000000-0000-4000-8000-000000000002",
              result_payment_attempt_id: "00000000-0000-4000-8000-000000000003",
              result_order_nsu: "MJ-000001",
              result_total_cents: rpcTotalCents,
              result_attempt_status: "creating",
              result_checkout_url: null
            }
          ],
          error: null
        };
      }
      if (operation === "ecommerce_checkout_link_transition") {
        return {
          data: [
            {
              result_code: args.p_action === "claim" ? "reserved" : args.p_action === "begin_dispatch" ? "dispatch_granted" : "registered",
              result_attempt_id: "00000000-0000-4000-8000-000000000003",
              result_attempt_status: args.p_action === "complete" ? "pending" : "creating",
              result_checkout_url: args.p_checkout_url ?? null,
              result_provider_checkout_id: args.p_provider_checkout_id ?? null,
              result_lease_expires_at: new Date(Date.now() + 120000).toISOString()
            }
          ],
          error: null
        };
      }
      return { data: true, error: null };
    });
  });

  afterEach(() => {
    if (originalCatalogSource === undefined) delete process.env.CHECKOUT_CATALOG_SOURCE;
    else process.env.CHECKOUT_CATALOG_SOURCE = originalCatalogSource;
    vi.restoreAllMocks();
  });

  it("recalcula o preço no servidor e não aceita preço no payload do navegador", async () => {
    const result = await createCheckout(request, "https://marjouxsjoias.com.br");

    expect(result.totalCents).toBe(17990);
    const createCall = mocks.rpc.mock.calls.find(([operation]) => operation === "ecommerce_create_checkout");
    expect(createCall?.[1].p_order.subtotal_cents).toBe(17990);
    expect(createCall?.[1].p_order.customer_cpf).toBeNull();
    expect(createCall?.[1].p_items[0].unit_price_cents).toBe(17990);
  });

  it("retirada não consulta Melhor Envio mesmo quando a cotação está offline", async () => {
    mocks.quoteShipping.mockRejectedValue(new Error("Shipping offline"));
    try {
      const result = await createCheckout(request, "https://marjouxsjoias.com.br");
      expect(mocks.quoteShipping).not.toHaveBeenCalled();
      const createCall = mocks.rpc.mock.calls.find(([operation]) => operation === "ecommerce_create_checkout");
      expect(createCall?.[1].p_order).toMatchObject({ delivery_method: "pickup", shipping_cents: 0 });
      expect(createCall?.[1].p_order).not.toHaveProperty("shipping_zip");
      expect(result.totalCents).toBe(17990);
    } finally {
      mocks.quoteShipping.mockReset();
    }
  });

  it("usa o preço do Supabase no pedido e na InfinitePay", async () => {
    useDatabaseProduct();
    rpcTotalCents = 16000;

    const result = await createCheckout({
      ...request,
      items: [{ ...request.items[0], displayedUnitPriceCents: 16000 }]
    }, "https://marjouxsjoias.com.br");
    expect(result.totalCents).toBe(16000);
    const createCall = mocks.rpc.mock.calls.find(([operation]) => operation === "ecommerce_create_checkout");
    expect(createCall?.[1].p_order).toMatchObject({
      subtotal_cents: 16000, shipping_cents: 0, discount_cents: 0, total_cents: 16000
    });
    expect(createCall?.[1].p_items[0].unit_price_cents).toBe(16000);
    expect(mocks.createProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ price: 16000, quantity: 1 })]
    }));
  });

  it("mantém entrega e frete sobre o subtotal autoritativo", async () => {
    useDatabaseProduct();
    rpcTotalCents = 16500;
    mocks.quoteShipping.mockResolvedValue([{
      shippingQuoteId: "00000000-0000-4000-8000-000000000010",
      serviceId: "3",
      serviceName: ".Package",
      carrierName: "Jadlog",
      priceCents: 500,
      deliveryTimeDays: 4,
      quotedAt: "2026-09-28T12:00:00.000Z"
    }]);

    const result = await createCheckout({
      ...request,
      items: [{ ...request.items[0], displayedUnitPriceCents: 16000 }],
      delivery: {
        method: "shipping" as const,
        address: {
          postalCode: "20040002", street: "Rua Teste", number: "10", complement: "",
          neighborhood: "Centro", city: "Rio de Janeiro", state: "RJ",
          serviceId: "3", shippingQuoteId: "00000000-0000-4000-8000-000000000010"
        }
      }
    }, "https://marjouxsjoias.com.br");

    expect(mocks.quoteShipping).toHaveBeenCalledWith("20040002", 16000);
    const createCall = mocks.rpc.mock.calls.find(([operation]) => operation === "ecommerce_create_checkout");
    expect(createCall?.[1].p_order).toMatchObject({
      subtotal_cents: 16000, shipping_cents: 500, discount_cents: 0, total_cents: 16500
    });
    expect(mocks.createProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ price: 16000 }), expect.objectContaining({ price: 500 })]
    }));
    expect(result.totalCents).toBe(16500);
  });

  it("não cria pedido nem link quando preço ou disponibilidade mudou", async () => {
    useDatabaseProduct();
    await expect(createCheckout({
      ...request,
      items: [{ ...request.items[0], displayedUnitPriceCents: 100 }]
    }, "https://marjouxsjoias.com.br")).rejects.toMatchObject({ code: "price_changed" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createProviderCheckout).not.toHaveBeenCalled();

    mocks.from.mockClear();
    useDatabaseProduct(false);
    await expect(createCheckout({
      ...request,
      items: [{ ...request.items[0], displayedUnitPriceCents: 16000 }]
    }, "https://marjouxsjoias.com.br")).rejects.toMatchObject({ code: "product_unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  const shippingDelivery = {
    method: "shipping" as const,
    address: { postalCode: "07400805", street: "Rua de teste", number: "10", complement: "",
      neighborhood: "Centro", city: "Arujá", state: "SP", serviceId: "2",
      shippingQuoteId: "00000000-0000-4000-8000-000000000010" }
  };
  const sedex = {
    shippingQuoteId: "00000000-0000-4000-8000-000000000011", serviceId: "2",
    serviceName: "SEDEX", carrierName: "Correios", priceCents: 2885, deliveryTimeDays: 2,
    quotedAt: "2026-10-21T12:00:00.000Z"
  };

  it("500 + 28,85 usa cotação nova, snapshot próprio e cobra frete uma única vez", async () => {
    useDatabaseProduct(true, "500.00");
    rpcTotalCents = 52885;
    mocks.quoteShipping.mockResolvedValue([sedex]);
    const result = await createCheckout({ ...request, items: [{ ...request.items[0], displayedUnitPriceCents: 50000 }],
      delivery: shippingDelivery }, "https://marjouxsjoias.com.br");
    expect(mocks.quoteShipping).toHaveBeenCalledWith("07400805", 50000);
    const snapshot = mocks.rpc.mock.calls.find(([operation]) => operation === "ecommerce_create_checkout")?.[1];
    expect(snapshot.p_order).toMatchObject({ delivery_method: "shipping", shipping_zip: "07400805",
      shipping_carrier: "Correios", shipping_service: "SEDEX", shipping_service_id: "2",
      shipping_quote_id: sedex.shippingQuoteId, shipping_quoted_at: sedex.quotedAt, shipping_deadline_days: 2,
      subtotal_cents: 50000, shipping_cents: 2885, discount_cents: 0, total_cents: 52885 });
    expect(snapshot.p_items).toHaveLength(1);
    expect(snapshot.p_items[0]).toMatchObject({ unit_price_cents: 50000, quantity: 1 });
    const providerItems = mocks.createProviderCheckout.mock.calls[0][0].items;
    expect(providerItems).toHaveLength(2);
    expect(providerItems[1]).toMatchObject({ price: 2885, quantity: 1 });
    expect(providerItems.reduce((total: number, item: { price: number; quantity: number }) => total + item.price * item.quantity, 0)).toBe(52885);
    expect(result.totalCents).toBe(52885);
  });

  it.each(["shippingCents", "carrierName", "totalCents"])("API rejeita campo financeiro injetado %s", (field) => {
    expect(createCheckoutSchema.safeParse({ ...request, delivery: {
      ...shippingDelivery, address: { ...shippingDelivery.address, [field]: field === "carrierName" ? "Outra" : 1 }
    } }).success).toBe(false);
    expect(createCheckoutSchema.safeParse({ ...request, [field]: 1 }).success).toBe(false);
  });

  it("serviço adulterado sem opção autorizada bloqueia pedido e pagamento", async () => {
    mocks.quoteShipping.mockResolvedValue([sedex]);
    await expect(createCheckout({ ...request, delivery: {
      ...shippingDelivery, address: { ...shippingDelivery.address, serviceId: "999" }
    } }, "https://marjouxsjoias.com.br")).rejects.toMatchObject({ code: "shipping_service_unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createProviderCheckout).not.toHaveBeenCalled();
  });

  it("CEP alterado exige cotação atual e não reaproveita modalidade sem cobertura", async () => {
    mocks.quoteShipping.mockResolvedValue([]);
    await expect(createCheckout({ ...request, delivery: {
      ...shippingDelivery, address: { ...shippingDelivery.address, postalCode: "20040002" }
    } }, "https://marjouxsjoias.com.br")).rejects.toMatchObject({ code: "shipping_service_unavailable" });
    expect(mocks.quoteShipping).toHaveBeenCalledWith("20040002", 17990);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createProviderCheckout).not.toHaveBeenCalled();
  });

  it("classifica a constraint da criação sem chamar a InfinitePay", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23514",
        message:
          'new row for relation "ecommerce_orders" violates check constraint "ecommerce_orders_delivery_data_ck"',
        details: "Failing row contains (cliente@example.com, 11999999999)."
      }
    });

    await expect(createCheckout(request, "https://marjouxsjoias.com.br")).rejects.toMatchObject({
      publicCode: "checkout_order_creation_error",
      status: 500,
      diagnostic: {
        stage: "ecommerce_orders",
        error_code: "check_violation",
        postgres_code: "23514",
        constraint_name: "ecommerce_orders_delivery_data_ck",
        rpc_name: "ecommerce_create_checkout",
        order_nsu: null,
        http_status: 500
      }
    });
    expect(mocks.createProviderCheckout).not.toHaveBeenCalled();
  });

  it("compartilha a criação externa quando a mesma tentativa chega em paralelo", async () => {
    let releaseProvider!: () => void;
    mocks.createProviderCheckout.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseProvider = () =>
            resolve({
              checkoutUrl: "https://checkout.infinitepay.com.br/marjouxs?lenc=fatura-1",
              providerCheckoutId: "fatura-1"
            });
        })
    );

    const first = createCheckout(request, "https://marjouxsjoias.com.br");
    const second = createCheckout(request, "https://marjouxsjoias.com.br");
    await vi.waitFor(() => expect(mocks.createProviderCheckout).toHaveBeenCalledTimes(1));
    releaseProvider();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.checkoutUrl).toBe(secondResult.checkoutUrl);
    expect(mocks.createProviderCheckout).toHaveBeenCalledTimes(1);
  });
});
