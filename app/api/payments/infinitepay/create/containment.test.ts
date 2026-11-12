import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  createInfinitePayCheckout: vi.fn()
}));

vi.mock("@/lib/checkout/create-checkout", () => ({ createCheckout: mocks.createCheckout }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/lib/checkout/infinitepay", () => ({ createInfinitePayCheckout: mocks.createInfinitePayCheckout }));

import { POST } from "./route";

describe("temporary checkout creation containment", () => {
  it.each(["{}", "not JSON"])("blocks %s before reading the request or reaching checkout", async (body) => {
    const request = new Request("https://example.invalid/api/payments/infinitepay/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    const readBody = vi.spyOn(request, "json");

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      error: "O checkout está temporariamente indisponível. Tente novamente em alguns instantes.",
      code: "checkout_temporarily_unavailable"
    });
    expect(readBody).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(mocks.createInfinitePayCheckout).not.toHaveBeenCalled();
  });
});
