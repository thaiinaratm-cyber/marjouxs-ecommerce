import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";

const { activeAdmin, rpc, from } = vi.hoisted(() => ({ activeAdmin: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: activeAdmin }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ from, rpc }) }));

import { saveAdminShipment } from "@/lib/admin/order-shipment";
import { getPrivateShipment } from "./private-shipment";

const token = "11111111-1111-4111-8111-111111111111";
const order = confirmationFixture({ deliveryMethod: "shipping", paymentStatus: "paid" });
const form = {
  id: token, expectedUpdatedAt: "2026-11-16T12:04:05.123456+00:00", carrier: "  Jadlog ",
  code: "AB123456789BR", url: "", status: "shipped", confirmDelivered: false
};

beforeEach(() => {
  activeAdmin.mockReset().mockResolvedValue({ id: "test-admin" });
  rpc.mockReset().mockResolvedValue({ data: "saved", error: null });
});

describe("admin-only shipment updates", () => {
  it("rejects unauthenticated requests before any server-side data access", async () => {
    activeAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(saveAdminShipment(form)).rejects.toThrow("forbidden");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not submit invalid data to the database", async () => {
    expect(await saveAdminShipment({ ...form, code: "<b>test</b>" })).toBe("invalid");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends only shipment fields and the optimistic revision to the RPC", async () => {
    expect(await saveAdminShipment({ ...form, order_status: "completed", payment_status: "failed", shipping_cents: 0 })).toBe("saved");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("ecommerce_update_order_shipment", {
      p_order_id: token, p_expected_updated_at: form.expectedUpdatedAt, p_carrier: "Jadlog",
      p_code: form.code, p_url: null, p_status: "shipped", p_confirm_delivered: false
    });
  });
  it("does not retry a conflict or expose a SQL error", async () => {
    rpc.mockResolvedValueOnce({ data: "conflict" }).mockResolvedValueOnce({ error: { message: "private values" } });
    expect(await saveAdminShipment(form)).toBe("conflict");
    expect(await saveAdminShipment(form)).toBe("failed");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("private shipment reads", () => {
  it("does not query without a well-formed token, for pickup or for pending payments", async () => {
    expect(await getPrivateShipment("", order)).toBeNull();
    expect(await getPrivateShipment(token, { ...order, deliveryMethod: "pickup" })).toBeNull();
    expect(await getPrivateShipment(token, { ...order, paymentStatus: "pending" })).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("binds the cookie and public order number in the same query, so order A cannot read order B", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null })
    };
    from.mockReturnValue(query);
    expect(await getPrivateShipment(token, { ...order, orderNumber: "MJ-000999" })).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("ecommerce_orders");
    expect(query.eq.mock.calls).toEqual([
      ["public_token", token], ["order_number", "MJ-000999"], ["delivery_method", "shipping"], ["payment_status", "paid"]
    ]);
    expect(query.neq).toHaveBeenCalledWith("order_status", "cancelled");
    expect(query.select.mock.calls[0][0]).not.toMatch(/address|customer|token|receipt/);
  });
});
