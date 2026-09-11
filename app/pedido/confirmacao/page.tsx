import { OrderConfirmation } from "@/components/order-confirmation";

export const dynamic = "force-dynamic";

export default function OrderConfirmationPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  return <OrderConfirmation token={searchParams.token ?? ""} />;
}
