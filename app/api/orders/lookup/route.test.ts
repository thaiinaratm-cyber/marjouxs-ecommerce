import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/orders/tracking-reader", () => ({ getVerifiedOrderAccessToken: mocks.verify }));
vi.mock("@/lib/orders/tracking-limit", () => ({ consumeOrderLookup: mocks.limit }));
import { POST } from "@/app/api/orders/lookup/route";

const token = "00000000-0000-4000-8000-000000000099";
const valid = { orderNumber: "MJ-000123", phone: "11999999999" };

function lookupRequest(body: unknown, headers: HeadersInit = { "Content-Type": "application/json" }) {
  return new Request("https://marjouxsjoias.com.br/api/orders/lookup", {
    method: "POST", headers, body: JSON.stringify(body)
  });
}

describe("consulta de pedido por telefone", () => {
  beforeEach(() => {
    mocks.verify.mockReset();
    mocks.limit.mockReset().mockReturnValue(0);
  });

  it.each(["(11) 99999-9999", "11999999999", "+55 11 99999-9999"])(
    "normaliza %s e concede acesso somente via cookie restrito",
    async phone => {
      mocks.verify.mockResolvedValue(token);
      const result = await POST(lookupRequest({ orderNumber: " mj000123 ", phone }));
      expect(result.status).toBe(204);
      expect(mocks.verify).toHaveBeenCalledWith("MJ-000123", valid.phone);
      expect(result.headers.get("set-cookie")).toMatch(/Path=\/pedido\/acompanhamento;.*HttpOnly;.*SameSite=strict/i);
      expect(result.headers.get("set-cookie")).toContain("Max-Age=1800");
      expect(result.headers.get("cache-control")).toContain("no-store");
      expect(result.headers.get("referrer-policy")).toBe("no-referrer");
      expect(await result.text()).toBe("");
      expect(result.headers.get("location")).toBeNull();
    }
  );

  it("sets Secure on production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      mocks.verify.mockResolvedValue(token);
      expect((await POST(lookupRequest(valid))).headers.get("set-cookie")).toMatch(/;\s*Secure/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not distinguish a missing order from the wrong phone", async () => {
    mocks.verify.mockResolvedValue(null);
    const wrong = await POST(lookupRequest(valid));
    const missing = await POST(lookupRequest({ ...valid, orderNumber: "MJ-999999" }));
    expect(wrong.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    expect(await wrong.json()).toEqual(await missing.json());
  });

  it.each([
    { orderNumber: valid.orderNumber },
    { orderNumber: valid.orderNumber, email: "qa@example.invalid" },
    { ...valid, phone: "119999999991" },
    { ...valid, phone: "+1 11 99999-9999" },
    { ...valid, extra: "x".repeat(1024) }
  ])("does not read the database on invalid credentials", async input => {
    const result = await POST(lookupRequest(input));
    expect(result.status).toBe(404);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("rejects cross-site submissions before database access", async () => {
    const result = await POST(lookupRequest(valid, { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    expect(result.status).toBe(404);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it.each([false, true])("throttles before accessing the database (per order: %s)", async perOrder => {
    mocks.limit.mockReturnValueOnce(perOrder ? 0 : 17).mockReturnValue(17);
    const result = await POST(lookupRequest(valid));
    expect(result.status).toBe(429);
    expect(result.headers.get("retry-after")).toBe("17");
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("does not leak internal errors or customer data", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.verify.mockRejectedValue(Error("checkout_url, customer_phone, provider ID"));
      const result = await POST(lookupRequest(valid));
      expect(result.status).toBe(503);
      expect(result.headers.get("set-cookie")).toBeNull();
      expect(await result.text()).not.toMatch(/checkout_url|customer_phone|provider ID/);
      expect(logger.mock.lastCall).toEqual(["Public order lookup is temporarily unavailable"]);
    } finally {
      logger.mockRestore();
    }
  });
});
