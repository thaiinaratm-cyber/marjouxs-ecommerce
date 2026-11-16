import "server-only";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { editableShipment, shipmentDetails, shipmentFields, shipmentFormSchema } from "@/lib/orders/shipment";
import type { OrderSummary } from "@/lib/orders/model";

export async function getAdminShipment(order: Pick<OrderSummary, "id" | "delivery_method" | "payment_status" | "order_status">) {
  await requireActiveAdmin();
  if (!editableShipment(order)) return null;
  const { data, error } = await getSupabaseAdmin().from("ecommerce_orders").select(shipmentFields)
    .eq("id", order.id).maybeSingle();
  return error || !data ? null : shipmentDetails(data);
}

export async function saveAdminShipment(input: unknown) {
  await requireActiveAdmin();
  const parsed = shipmentFormSchema.safeParse(input);
  if (!parsed.success) return "invalid";

  const values = parsed.data;
  const { data, error } = await getSupabaseAdmin().rpc("ecommerce_update_order_shipment", {
    p_order_id: values.id,
    p_expected_updated_at: values.expectedUpdatedAt,
    p_carrier: values.carrier,
    p_code: values.code,
    p_url: values.url,
    p_status: values.status,
    p_confirm_delivered: values.confirmDelivered
  });
  return !error && (data === "saved" || data === "invalid" || data === "conflict") ? data : "failed";
}
