import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), reconcile: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: mocks.auth }));
vi.mock("@/lib/admin/reconcile-payment", () => ({ reconcileAdminOrderPayment: mocks.reconcile }));
vi.mock("@/lib/admin/orders", () => ({ changeAdminOrderStatus: vi.fn() }));
vi.mock("@/lib/admin/order-shipment", () => ({ saveAdminShipment: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { reconcilePaymentAction } from "@/app/admin/(protected)/pedidos/actions";

const orderId = "00000000-0000-4000-8000-000000000001";
describe("authenticated manual payment server action", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "admin" }); mocks.reconcile.mockResolvedValue("reconcile_paid"); });
  it("ignores forged financial/provider fields and sends only the authorized order ID", async () => {
    const form = new FormData(); form.set("id", orderId);
    for (const [key, value] of Object.entries({ amount: "1", paid_amount: "1", status: "paid", transaction_nsu: "forged", attempt_id: "forged" })) form.set(key, value);
    await expect(reconcilePaymentAction(form)).rejects.toThrow(`redirect:/admin/pedidos/${orderId}?result=reconcile_paid`);
    expect(mocks.reconcile).toHaveBeenCalledWith(orderId);
    expect(mocks.reconcile.mock.calls[0]).toHaveLength(1);
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/pedidos");
    expect(mocks.revalidate).toHaveBeenCalledWith(`/admin/pedidos/${orderId}`);
  });
  it("rechecks authentication on submit, not only when rendering the admin page", async () => {
    mocks.auth.mockRejectedValue(new Error("not_admin"));
    const form = new FormData(); form.set("id", orderId);
    await expect(reconcilePaymentAction(form)).rejects.toThrow("not_admin");
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it("invalid order identifiers never reach reconciliation", async () => {
    const form = new FormData(); form.set("id", "invalid");
    await expect(reconcilePaymentAction(form)).rejects.toThrow("redirect:/admin/pedidos");
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
