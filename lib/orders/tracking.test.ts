import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVerifiedOrderAccessToken } from "@/lib/orders/tracking-reader";
import { createOrderLookupLimiter } from "@/lib/orders/tracking-limit";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));

describe("tracking reader", () => {
  const token = "00000000-0000-4000-8000-000000000099";
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.read });
  });
  it("compares the stored phone without reading the rest of the order", async () => {
    mocks.read.mockResolvedValue({ data: { customer_phone: "+55 (11) 99999-9999", public_token: token }, error: null });
    await expect(getVerifiedOrderAccessToken("MJ-000123", "11999999999")).resolves.toBe(token);
    expect(mocks.select.mock.calls).toEqual([["customer_phone, public_token"]]);
    expect(mocks.eq.mock.calls).toEqual([["order_number", "MJ-000123"]]);
  });
  it.each([null, { customer_phone: "11988888888", public_token: token },
    { customer_phone: "11999999999", public_token: "invalid" }])("fails closed", async data => {
    mocks.read.mockResolvedValue({ data, error: null });
    await expect(getVerifiedOrderAccessToken("MJ-000123", "11999999999")).resolves.toBeNull();
  });
});

it("blocks bursts for the same order and caps totals per worker, then resets", () => {
  let now = 1;
  const consume = createOrderLookupLimiter(() => now);
  for (let i = 0; i < 6; i++) { expect(consume()).toBe(0); expect(consume("MJ-000123")).toBe(0); }
  expect(consume("MJ-000123")).toBe(60);
  expect(consume("MJ-000124")).toBe(0);
  for (let i = 6; i < 120; i++) expect(consume()).toBe(0);
  now += 1000;
  expect(consume()).toBe(59);
  now += 59_000;
  expect(consume()).toBe(0);
  expect(consume("MJ-000123")).toBe(0);
});
