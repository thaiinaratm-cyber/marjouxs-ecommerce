import { z } from "zod";
import type { OrderStatus, OrderSummary } from "./model";

export const shipmentStatuses = ["preparing", "shipped", "in_transit", "delivered"] as const;
export type ShipmentStatus = typeof shipmentStatuses[number];
export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  preparing: "Preparando", shipped: "Enviado", in_transit: "Em tr\u00e2nsito", delivered: "Entregue"
};

export const shipmentFields = "dispatch_carrier,tracking_code,tracking_url,shipping_status,shipped_at,in_transit_at,delivered_at";
const carrierSchema = z.string().trim().min(1).max(100).regex(/^[^<>\u0000-\u001f\u007f-\u009f]+$/);
const codeSchema = z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);
const dateSchema = z.iso.datetime({ offset: true });
const statusSchema = z.enum(shipmentStatuses);

export function safeTrackingUrl(value: string | null) {
  const text = value?.trim();
  if (!text || text.length > 2048 || !/^https:\/\/[^/]/i.test(text) || /[\s\\\u0000-\u001f\u007f-\u009f]/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password && url.href.length <= 2048
      ? url.href : null;
  } catch {
    return null;
  }
}

const optional = (schema: z.ZodType<string, string>) => z.string().trim().transform(value => value || null).pipe(schema.nullable());
export const shipmentFormSchema = z.object({
  id: z.uuid(),
  expectedUpdatedAt: dateSchema,
  carrier: optional(carrierSchema),
  code: optional(codeSchema),
  url: optional(z.string().transform(safeTrackingUrl).pipe(z.string())),
  status: statusSchema,
  confirmDelivered: z.boolean()
});

export function shipmentDetails(row: Record<string, unknown> | null) {
  return {
    carrier: carrierSchema.safeParse(row?.dispatch_carrier).data ?? null,
    code: codeSchema.safeParse(row?.tracking_code).data ?? null,
    url: typeof row?.tracking_url === "string" ? safeTrackingUrl(row.tracking_url) : null,
    status: statusSchema.safeParse(row?.shipping_status).data ?? null,
    shippedAt: dateSchema.safeParse(row?.shipped_at).data ?? null,
    inTransitAt: dateSchema.safeParse(row?.in_transit_at).data ?? null,
    deliveredAt: dateSchema.safeParse(row?.delivered_at).data ?? null
  };
}

export type ShipmentDetails = ReturnType<typeof shipmentDetails>;

export function editableShipment(order: Pick<OrderSummary, "delivery_method" | "payment_status" | "order_status">) {
  return order.delivery_method === "shipping" && order.payment_status === "paid"
    && ["paid", "preparing", "shipped", "completed"].includes(order.order_status);
}

export function shipmentStageForAdmin(status: ShipmentStatus | null, operational: OrderStatus): ShipmentStatus {
  return status ?? (operational === "completed" ? "delivered" : operational === "shipped" ? "shipped" : "preparing");
}

export function shipmentStatusOptions(current: ShipmentStatus) {
  const index = shipmentStatuses.indexOf(current);
  return shipmentStatuses.slice(index, index + 2);
}

export function canUseOperationalStatus(order: Pick<OrderSummary, "delivery_method" | "order_status">, status: OrderStatus) {
  if (order.delivery_method !== "shipping") return true;
  if (status === "completed" || status === "shipped") return false;
  return status !== "cancelled" || order.order_status !== "shipped";
}
