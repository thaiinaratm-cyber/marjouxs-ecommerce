import { beforeEach, expect, it, vi } from "vitest";
const { activeAdmin, from, query } = vi.hoisted(() => ({
  activeAdmin: vi.fn(), from: vi.fn(), query: { select: vi.fn(), order: vi.fn(), range: vi.fn() }
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: activeAdmin }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ from }) }));

import { listRecoveries, readRecovery } from "./recovery";

beforeEach(() => {
  activeAdmin.mockReset().mockResolvedValue({ userId: "fixture" });
  from.mockReset().mockReturnValue(query);
  query.select.mockReset().mockReturnThis();
  query.order.mockReset().mockReturnThis();
  query.range.mockReset().mockResolvedValue({ data: [], count: 0, error: null });
});

it.each(["no session", "inactive admin"])("does not query for %s", async reason => {
  activeAdmin.mockRejectedValue(new Error(reason));
  await expect(listRecoveries({})).rejects.toThrow(reason);
  await expect(readRecovery("886df012-171d-4eb0-ac53-ecc66b546774")).rejects.toThrow(reason);
  expect(from).not.toHaveBeenCalled();
});
it("lets the active admin list only the minimal summary", async () => {
  expect(await listRecoveries({})).toMatchObject({ rows: [], page: 1 });
  expect(from).toHaveBeenCalledWith("ecommerce_checkout_recovery_admin");
  const columns: string = query.select.mock.calls[0][0];
  expect(columns).toContain("phone_last4");
  expect(columns).not.toMatch(/customer_phone|cart_items|token|checkout_request|email|cpf/);
});
