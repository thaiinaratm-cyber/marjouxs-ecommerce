import { describe, expect, it } from "vitest";
import { getOrderTimeline, getPrivateOrderTimeline } from "@/lib/order-status";
import { canUseOperationalStatus, editableShipment, safeTrackingUrl, shipmentDetails, shipmentFormSchema, shipmentStageForAdmin, shipmentStatusOptions, type ShipmentStatus } from "./shipment";

const base = {
  deliveryMethod: "shipping", statusStage: "production", paymentStatus: "paid"
} as const;
const form = {
  id: "12111111-1111-4111-8111-111111111111", expectedUpdatedAt: "2026-11-16T12:04:05.123456+00:00",
  carrier: "  Jadlog  ", code: " AB123456789BR ", url: "https://tracking.example/track?code=ab",
  status: "preparing", confirmDelivered: false
};

describe("shipment input", () => {
  it("normalizes valid values, preserving optional blanks", () => {
    expect(shipmentFormSchema.parse(form)).toMatchObject({ carrier: "Jadlog", code: "AB123456789BR", url: form.url });
    expect(shipmentFormSchema.parse({ ...form, carrier: "", code: " ", url: "" })).toMatchObject({ carrier: null, code: null, url: null });
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "http://carrier.example/tracking", "https:///wrong", "https://", "https://user:pass@track.example", "https://example.test\\evil", "https://track.example/a b"])("rejects URL %s", url => {
    expect(safeTrackingUrl(url)).toBeNull();
    expect(shipmentFormSchema.safeParse({ ...form, url }).success).toBe(false);
  });
  it.each(["<script>alert(1)</script>", "A".repeat(81), "A/B", "code with spaces"])("rejects code %s", code => {
    expect(shipmentFormSchema.safeParse({ ...form, code }).success).toBe(false);
  });
  it("does not leak stored unexpected keys or invalid legacy values", () => {
    expect(shipmentDetails({ dispatch_carrier: "Correios", tracking_code: "<script>", tracking_url: "data:text/html,test",
      shipping_status: "in_transit", customer_phone: "test" })).toEqual({
      carrier: "Correios", code: null, url: null, status: "in_transit", shippedAt: null, inTransitAt: null, deliveredAt: null
    });
  });
  it("does not allow pickup or unpaid shipment editing", () => {
    expect(editableShipment({ delivery_method: "pickup", order_status: "paid", payment_status: "paid" })).toBe(false);
    expect(editableShipment({ delivery_method: "shipping", order_status: "pending_payment", payment_status: "pending" })).toBe(false);
    expect(editableShipment({ delivery_method: "shipping", order_status: "cancelled", payment_status: "paid" })).toBe(false);
    expect(editableShipment({ delivery_method: "shipping", order_status: "paid", payment_status: "paid" })).toBe(true);
  });
  it("does not expose shipping progression in the legacy status form, preserving pickup", () => {
    expect(canUseOperationalStatus({ delivery_method: "shipping", order_status: "preparing" }, "shipped")).toBe(false);
    expect(canUseOperationalStatus({ delivery_method: "shipping", order_status: "shipped" }, "completed")).toBe(false);
    expect(canUseOperationalStatus({ delivery_method: "shipping", order_status: "shipped" }, "cancelled")).toBe(false);
    expect(canUseOperationalStatus({ delivery_method: "pickup", order_status: "ready_for_pickup" }, "completed")).toBe(true);
    expect(shipmentStageForAdmin(null, "shipped")).toBe("shipped");
    expect(shipmentStatusOptions("shipped")).toEqual(["shipped", "in_transit"]);
    expect(shipmentStatusOptions("delivered")).toEqual(["delivered"]);
  });
});

describe("private delivery timeline", () => {
  it.each<[ShipmentStatus | null, string[]]>([
    [null, ["upcoming", "upcoming", "upcoming"]],
    ["preparing", ["upcoming", "upcoming", "upcoming"]],
    ["shipped", ["complete", "upcoming", "upcoming"]],
    ["in_transit", ["complete", "complete", "upcoming"]],
    ["delivered", ["complete", "complete", "complete"]]
  ])("shows only milestones reached (%s)", (status, expected) => {
    const steps = getPrivateOrderTimeline(base, status);
    expect(steps.slice(-3).map(step => step.state)).toEqual(expected);
    expect(steps.find(step => step.id === "quality")?.state).toBe("untracked");
  });
  it("keeps the old shipment without making up in-transit status", () => {
    const steps = getPrivateOrderTimeline({ ...base, statusStage: "delivered" }, null);
    expect(steps.slice(-3).map(step => step.state)).toEqual(["complete", "untracked", "complete"]);
  });
  it("leaves pickup on the existing timeline even if shipment data was provided", () => {
    const pickup = { ...base, deliveryMethod: "pickup", statusStage: "ready" } as const;
    expect(getPrivateOrderTimeline(pickup, "delivered")).toEqual(getOrderTimeline(pickup));
  });
});
