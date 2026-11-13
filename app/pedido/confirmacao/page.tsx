import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order-confirmation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "Confirmação do pedido | Marjouxs",
  robots: {
    index: false,
    follow: false
  }
};

export default async function OrderConfirmationPage({
  searchParams: pendingSearchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await pendingSearchParams;
  return <OrderConfirmation token={searchParams.token ?? ""} />;
}
