import type { Metadata } from "next";
import { OrderTracking } from "@/components/order-tracking";

export const metadata: Metadata = {
  title: "Acompanhar pedido | Marjouxs",
  description: "Consulte com segurança o andamento do seu pedido Marjouxs.",
  robots: {
    index: false,
    follow: false
  }
};

export default async function TrackOrderPage({
  searchParams: pendingSearchParams
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const searchParams = await pendingSearchParams;
  return <OrderTracking initialOrderNumber={searchParams.pedido ?? ""} />;
}
