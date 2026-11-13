import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), shipping: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/checkout/shipping", async original => ({
  ...await original<typeof import("@/lib/checkout/shipping")>(), quoteShipping: mocks.shipping
}));
vi.mock("@/lib/checkout/infinitepay", async original => ({
  ...await original<typeof import("@/lib/checkout/infinitepay")>(), prepareInfinitePayCheckout: mocks.prepare
}));

import { POST } from "@/app/api/payments/infinitepay/create/route";

const productId = "00000000-0000-4000-8000-000000000101";
const base = {
  requestId: "00000000-0000-4000-8000-000000000001",
  items: [{ productId: "brinco-ponto-de-luz", productSlug: "brinco-ponto-de-luz", quantity: 1, customization: null, displayedUnitPriceCents: 16001 }],
  customer: { name: "Fixture QA", phone: "11000000000", email: "qa@example.invalid", cpf: "" },
  delivery: { method: "pickup" }
};
const shipping = { method: "shipping", address: {
  postalCode: "07400805", street: "Rua QA", number: "1", complement: "", neighborhood: "QA", city: "Arujá", state: "SP",
  serviceId: "2", shippingQuoteId: "00000000-0000-4000-8000-000000000050"
} };
const quote = { serviceId: "2", serviceName: "SEDEX", carrierName: "Correios", priceCents: 994, deliveryTimeDays: 2,
  shippingQuoteId: "00000000-0000-4000-8000-000000000051", quotedAt: "2026-11-04T12:00:00Z" };

function request(body: unknown) {
  return new Request("https://marjouxsjoias.com.br/api/payments/infinitepay/create", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}

describe("direct create endpoint adversarial audit (no network, no persisted orders)", () => {
  let product: Record<string, unknown>;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CHECKOUT_CATALOG_SOURCE", "database");
    vi.stubEnv("CHECKOUT_CATALOG_FALLBACK", "true");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marjouxsjoias.com.br");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in security audit"); }));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    product = { id: productId, legacy_id: base.items[0].productId, name: "Fixture QA", slug: base.items[0].productSlug,
      category_id: "category", subcategory_id: null, material_id: "material", price: "160.01", stock_status: "available",
      sale_unit: "unit", is_active: true, engraving_available: false, size_min: null, size_max: null };
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ in: (field: string, values: string[]) => {
      const rows: Record<string, Record<string, unknown>[]> = {
        ecommerce_products: [product], ecommerce_categories: [{ id: "category", name: "Brincos", is_active: true }],
        ecommerce_materials: [{ id: "material", name: "Ouro 18k", is_active: true }],
        ecommerce_product_images: [{ product_id: productId, path: "/produtos/qa.webp", source_type: "local", is_primary: true }]
      };
      const result = { data: (rows[table] ?? []).filter(row => values.includes(row[field] as string)), error: null };
      return { abortSignal: async () => result, eq: () => ({ abortSignal: async () => result }) };
    } }) }));
    // Stop deliberately at the persistence boundary: no order, attempt or link is created.
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "fixture stop before persistence" } });
    mocks.shipping.mockResolvedValue([quote]);
  });
  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });

  it.each([false, true])("revalidates manipulated prices for admin-only=%s", async manual => {
    if (manual) product.legacy_id = null;
    for (const cents of [0, 1, 100, 16000, 16002, 999999]) {
      const body = structuredClone(base);
      body.items[0].productId = manual ? productId : base.items[0].productId;
      body.items[0].displayedUnitPriceCents = cents;
      const response = await POST(request(body));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "price_changed", currentPriceCents: 16001 });
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["subtotal", "subtotalCents", "total", "totalCents", "amount", "paid_amount", "status", "paymentStatus", "shippingCents"])
  ("rejects client authority over %s", async field => {
    expect((await POST(request({ ...base, [field]: field === "status" ? "paid" : 1 }))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([{}, { ...base, items: [] }, { ...base, customer: null }, { ...base, delivery: { method: "delivery" } },
    { ...base, items: [{ ...base.items[0], displayedUnitPriceCents: -1 }] }])("rejects malformed checkout %j", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["inactive", "no-price", "unavailable"])("blocks %s even with static fallback enabled", async state => {
    if (state === "inactive") product.is_active = false;
    if (state === "no-price") product.price = null;
    if (state === "unavailable") product.stock_status = "unavailable";
    expect((await POST(request(base))).status).toBeGreaterThanOrEqual(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["00000000-0000-4000-8000-000000000999", "not-a-uuid", "erp_orders/1", "'); DROP TABLE products; --"])
  ("rejects an unknown identifier %s without leaking database details", async id => {
    const response = await POST(request({ ...base, items: [{ ...base.items[0], productId: id, productSlug: "unknown" }] }));
    expect(response.status).toBe(409); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toMatch(/SELECT|TABLE|schema|stack|erp_orders/);
    expect(mocks.from.mock.calls.every(([table]) => table.startsWith("ecommerce_"))).toBe(true);
  });

  it("uses the current server slug for a stable product ID, never a caller-provided name", async () => {
    await POST(request({ ...base, items: [{ ...base.items[0], productSlug: "obsolete-or-forged-slug" }] }));
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_items[0].product_slug).toBe(product.slug);
    expect(args.p_items[0].product_name).toBe(product.name);
  });

  it("recalculates cents, frete and transport deadline instead of trusting an old quote ID", async () => {
    const response = await POST(request({ ...base, delivery: shipping }));
    expect(response.status).toBe(500); // Deliberate mock stop at the persistence boundary.
    expect(mocks.shipping).toHaveBeenCalledWith("07400805", 16001);
    expect(mocks.rpc.mock.calls[0][1].p_order).toMatchObject({ subtotal_cents: 16001, shipping_cents: 994,
      total_cents: 16995, shipping_service_id: "2", shipping_deadline_days: 2, shipping_quote_id: quote.shippingQuoteId });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it.each([0, -100, 1, 999999])("rejects forged freight %i even when the rest is valid", async priceCents => {
    const response = await POST(request({ ...base, delivery: { ...shipping, address: { ...shipping.address, priceCents, deliveryTimeDays: 0 } } }));
    expect(response.status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("blocks unquoted services and never makes up a free delivery", async () => {
    for (const options of [[], [{ ...quote, serviceId: "3" }]]) {
      mocks.shipping.mockResolvedValue(options);
      const response = await POST(request({ ...base, delivery: shipping }));
      expect(response.status).toBe(422);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("pickup is zero with no provider request and rejects a hidden shipping address", async () => {
    await POST(request(base));
    expect(mocks.rpc.mock.calls[0][1].p_order).toMatchObject({ shipping_cents: 0, total_cents: 16001, customer_cpf: null });
    expect(mocks.shipping).not.toHaveBeenCalled();
    mocks.rpc.mockClear();
    expect((await POST(request({ ...base, delivery: { method: "pickup", address: shipping.address } }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not expose arbitrary database errors in the client or diagnostics", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "fixture-secret qa@example.invalid SELECT private_table" } });
    const response = await POST(request(base));
    expect(JSON.stringify(await response.json()) + JSON.stringify(vi.mocked(console.error).mock.calls))
      .not.toMatch(/fixture-secret|qa@example|private_table/);
  });
});
