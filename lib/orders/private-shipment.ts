import "server-only";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { shipmentDetails, shipmentFields } from "@/lib/orders/shipment";
import { orderAccessTokenSchema } from "@/lib/orders/tracking";
import type { PublicOrder } from "@/types/checkout";

export async function getPrivateShipment(token: string, order: PublicOrder) {
  if (!orderAccessTokenSchema.safeParse(token).success
    || order.deliveryMethod !== "shipping" || order.paymentStatus !== "paid") return null;

  const { data, error } = await getSupabaseAdmin().from("ecommerce_orders").select(shipmentFields)
    .eq("public_token", token).eq("order_number", order.orderNumber)
    .eq("delivery_method", "shipping").eq("payment_status", "paid")
    .neq("order_status", "cancelled").maybeSingle();
  return error || !data ? null : shipmentDetails(data);
}
