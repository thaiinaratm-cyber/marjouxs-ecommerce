import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order-confirmation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmação do pedido | Marjouxs",
  robots: {
    index: false,
    follow: false
  }
};

export default function OrderConfirmationPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  return <OrderConfirmation token={searchParams.token ?? ""} />;
}
