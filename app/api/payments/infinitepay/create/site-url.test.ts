import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createCheckout: vi.fn() }));
vi.mock("@/lib/checkout/create-checkout", () => ({ createCheckout: mocks.createCheckout }));
vi.mock("@/lib/checkout/shipping", () => ({
  ShippingProviderError: class extends Error {
    constructor(message: string, readonly code: string, readonly status = 502) { super(message); }
  }
}));

import { POST } from "@/app/api/payments/infinitepay/create/route";

const payload = {
  requestId: "00000000-0000-4000-8000-000000000001",
  items: [{ productId: "fixture-product", productSlug: "fixture-product", quantity: 1, customization: null }],
  customer: { name: "Cliente QA", email: "qa@example.invalid", phone: "11999990000", cpf: "" },
  delivery: { method: "pickup" }
};

function request(resumeOrder?: string) {
  return new Request("https://marjouxsjoias.com.br/api/payments/infinitepay/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(resumeOrder ? { "X-Checkout-Resume": resumeOrder } : {}) },
    body: JSON.stringify(payload)
  });
}

describe("checkout route production origin guard", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createCheckout.mockReset();
    mocks.createCheckout.mockResolvedValue({ checkoutUrl: "https://example.invalid/fixture" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    undefined,
    "",
    "http://marjouxsjoias.com.br",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://192.168.0.1",
    "https://marjouxsjoias.com.br.evil.test",
    "https://evil.test/marjouxsjoias.com.br",
    "https://private-user:private-password@marjouxsjoias.com.br"
  ])("rejects invalid production origin before order or link creation: %s", async value => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "A origem do checkout não está configurada corretamente.",
      code: "invalid_production_site_url"
    });
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    const diagnostics = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(diagnostics).toContain("checkout_configuration");
    expect(diagnostics).not.toContain("private-password");
    expect(diagnostics).not.toContain(payload.customer.email);
    expect(JSON.stringify(body)).not.toContain("private-password");
  });

  it("passes only the canonical production origin to the existing checkout flow", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marjouxsjoias.com.br/");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ requestId: payload.requestId });
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1);
    expect(mocks.createCheckout).toHaveBeenCalledWith(payload, "https://marjouxsjoias.com.br");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("continues to allow localhost in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1);
    expect(mocks.createCheckout).toHaveBeenCalledWith(payload, "http://localhost:3000");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not return a pending provider link until the current order is explicitly resumed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marjouxsjoias.com.br");
    const result = { orderNumber: "MJ-000002", checkoutUrl: "https://checkout.infinitepay.io/fixture",
      totalCents: 16000, reusedLink: true, alreadyPaid: false };
    mocks.createCheckout.mockResolvedValue(result);
    for (const header of [undefined, "MJ-000001"]) {
      const response = await POST(request(header));
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body).toMatchObject({ code: "checkout_resume_required", orderNumber: result.orderNumber,
        requestId: payload.requestId, totalCents: 16000 });
      expect(body).not.toHaveProperty("checkoutUrl");
    }
    const resumed = await POST(request(result.orderNumber));
    expect(resumed.status).toBe(200);
    expect(await resumed.json()).toEqual({ ...result, requestId: payload.requestId });
    expect(mocks.createCheckout).toHaveBeenCalledTimes(3);
    expect(mocks.createCheckout.mock.calls.every(([input]) => input.requestId === payload.requestId)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
