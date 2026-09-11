import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import type { PublicOrder, PublicOrderItem } from "@/types/checkout";
import { ringPairCustomizationSchema } from "@/lib/checkout/schemas";

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: PublicOrder["paymentStatus"];
  order_status: string;
  delivery_method: PublicOrder["deliveryMethod"];
  shipping_carrier: string | null;
  shipping_service: string | null;
  shipping_deadline_days: number | null;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  paid_at: string | null;
  ecommerce_order_items: Array<{
    id: string;
    line_number: number;
    product_slug: string;
    product_name: string;
    product_image: string;
    category: string;
    material: string | null;
    unit_price_cents: number;
    quantity: number;
    subtotal_cents: number;
    customization: unknown;
  }>;
};

function parseCustomization(value: unknown) {
  const parsed = ringPairCustomizationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function getPublicOrder(publicToken: string): Promise<PublicOrder | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ecommerce_orders")
    .select(
      "id, order_number, payment_status, order_status, delivery_method, shipping_carrier, shipping_service, shipping_deadline_days, subtotal_cents, shipping_cents, discount_cents, total_cents, paid_at, ecommerce_order_items(id, line_number, product_slug, product_name, product_image, category, material, unit_price_cents, quantity, subtotal_cents, customization)"
    )
    .eq("public_token", publicToken)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível consultar o pedido: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const order = data as unknown as OrderRow;
  const { data: paymentAttempt, error: paymentError } = await supabase
    .from("ecommerce_payment_attempts")
    .select("capture_method, installments, receipt_url, status, created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new Error(`Não foi possível consultar o pagamento: ${paymentError.message}`);
  }

  const items: PublicOrderItem[] = [...(order.ecommerce_order_items ?? [])]
    .sort((left, right) => left.line_number - right.line_number)
    .map((item) => ({
      id: item.id,
      productSlug: item.product_slug,
      productName: item.product_name,
      productImage: item.product_image,
      category: item.category,
      material: item.material,
      unitPriceCents: Number(item.unit_price_cents),
      quantity: item.quantity,
      subtotalCents: Number(item.subtotal_cents),
      customization: parseCustomization(item.customization)
    }));

  const captureMethod = paymentAttempt?.capture_method;
  return {
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    deliveryMethod: order.delivery_method,
    shippingCarrier: order.shipping_carrier,
    shippingService: order.shipping_service,
    shippingDeadlineDays: order.shipping_deadline_days,
    subtotalCents: Number(order.subtotal_cents),
    shippingCents: Number(order.shipping_cents),
    discountCents: Number(order.discount_cents),
    totalCents: Number(order.total_cents),
    paidAt: order.paid_at,
    paymentMethod:
      captureMethod === "pix" || captureMethod === "credit_card" ? captureMethod : null,
    installments:
      typeof paymentAttempt?.installments === "number" ? paymentAttempt.installments : null,
    receiptUrl:
      typeof paymentAttempt?.receipt_url === "string" &&
      paymentAttempt.receipt_url.startsWith("https://")
        ? paymentAttempt.receipt_url
        : null,
    items
  };
}
