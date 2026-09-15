import type { Metadata } from "next";
import { OrderTracking } from "@/components/order-tracking";

export const metadata: Metadata = {
  title: "Acompanhar pedido | Marjouxs",
  description: "Consulte com segurança o andamento do seu pedido Marjouxs."
};

export default function TrackOrderPage({
  searchParams
}: {
  searchParams: { pedido?: string };
}) {
  return <OrderTracking initialOrderNumber={searchParams.pedido ?? ""} />;
}
