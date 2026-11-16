import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrderConfirmationView } from "@/components/order-confirmation";
import { OrderShipmentTracking } from "@/components/order-shipment-tracking";
import { getPublicOrder } from "@/lib/checkout/orders";
import { parseConfirmationOrder } from "@/lib/checkout/confirmation";
import { ORDER_TRACKING_COOKIE, orderAccessTokenSchema } from "@/lib/orders/tracking";
import { getPrivateShipment } from "@/lib/orders/private-shipment";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Andamento do pedido | Marjouxs",
  referrer: "no-referrer",
  robots: { index: false, follow: false }
};

export default async function OrderProgressPage() {
  const token = orderAccessTokenSchema.safeParse((await cookies()).get(ORDER_TRACKING_COOKIE)?.value);
  if (!token.success) redirect("/acompanhar-pedido");

  let raw;
  try {
    raw = await getPublicOrder(token.data);
  } catch {
    return <OrderConfirmationView tracking state={{ order: null, phase: "temporary_error", refreshing: false }} />;
  }
  if (!raw) redirect("/acompanhar-pedido");

  const order = parseConfirmationOrder(raw);
  const shipment = order ? await getPrivateShipment(token.data, order) : null;
  return <OrderConfirmationView tracking shipmentStatus={shipment?.status}
    shipment={shipment ? <OrderShipmentTracking shipment={shipment} /> : null}
    state={{ order, phase: order ? "ready" : "temporary_error", refreshing: false }} />;
}
