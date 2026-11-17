import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { resolve, rpc, write } = vi.hoisted(() => ({ resolve: vi.fn(), rpc: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/checkout/catalog-server", () => ({ resolveAuthoritativeCheckoutCart: resolve }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import { CheckoutValidationError } from "@/lib/checkout/catalog";
import { POST } from "./route";

const domain = "https://example.test";
const items = [{ productId: "a", productSlug: "a", quantity: 1, customization: null }];
const payload = { items, token: "a".repeat(64), revision: 1, phone: "+55 (11) 98765-4321", name: "QA",
  contactAllowed: false, deliveryMethod: "shipping" };
const send = (data: unknown, origin = domain) => POST(new Request(domain + "/api/checkout/recovery", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(data)
}));

beforeEach(() => {
  write.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockReturnValue({ abortSignal: write });
  resolve.mockReset().mockResolvedValue({ subtotalCents: 16000, items: [{ ...items[0], name: "QA Item", unitPriceCents: 16000, image: "/ignore.jpg" }] });
});
afterEach(() => vi.unstubAllEnvs());

it("validates origin, contact and body size before processing", async () => {
  expect((await send(payload, "https://elsewhere.test")).status).toBe(403);
  expect((await send({ ...payload, phone: "invalid" })).status).toBe(400);
  expect((await send({ ...payload, name: "x".repeat(33000) })).status).toBe(400);
  expect(resolve).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it("accepts only the configured canonical origin when Next uses an internal URL", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.test");
  expect((await send({ ...payload, token: "b".repeat(64) }, "https://shop.example.test")).status).toBe(204);
  expect((await send(payload, "https://not-shop.example.test")).status).toBe(403);
  expect((await send(payload, "null")).status).toBe(403);
});

it("stores only validated cart projections with a hash; returns no ID, phone or status", async () => {
  const response = await send(payload);
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(resolve).toHaveBeenCalledWith(items, "report");
  expect(rpc.mock.calls[0][0]).toBe("ecommerce_record_checkout_recovery");
  const args = rpc.mock.calls[0][1];
  expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(args.p_token_hash).not.toBe(payload.token);
  expect(args).toMatchObject({ p_phone: "11987654321", p_subtotal: 16000, p_delivery: "shipping", p_request_id: null });
  expect(args.p_items).toEqual([{ productId: "a", name: "QA Item", unitPriceCents: 16000, quantity: 1, customization: null }]);
});

it("excludes unpriced products and suppresses private database errors", async () => {
  resolve.mockRejectedValueOnce(new CheckoutValidationError("internal QA", "product_without_price"));
  expect((await send(payload)).status).toBe(204);
  expect(rpc).not.toHaveBeenCalled();
  write.mockResolvedValueOnce({ error: { message: "must not leak" } });
  const response = await send(payload);
  expect(response.status).toBe(503);
  expect(await response.text()).toBe("");
});
