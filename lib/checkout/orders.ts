import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { getOrderPresentationStage } from "@/lib/order-status";
import { publicOrderStone } from "@/lib/stone-customization";
import type { PublicOrder, PublicOrderItem } from "@/types/checkout";

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
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
    line_number: number;
    product_slug: string;
    product_name: string;
    product_image: string;
    category: string;
    material: string | null;
    unit_price_cents: number;
    quantity: number;
    subtotal_cents: number;
    customization?: unknown;
  }>;
};

const PUBLIC_ORDER_SELECT =
  "id, order_number, created_at, payment_status, order_status, delivery_method, shipping_carrier, shipping_service, shipping_deadline_days, subtotal_cents, shipping_cents, discount_cents, total_cents, paid_at, ecommerce_order_items(line_number, product_slug, product_name, product_image, category, material, unit_price_cents, quantity, subtotal_cents, customization)";

function emailDigest(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase(), "utf8").digest();
}

function emailsMatch(storedEmail: unknown, suppliedEmail: string) {
  if (typeof storedEmail !== "string") return false;
  return timingSafeEqual(emailDigest(storedEmail), emailDigest(suppliedEmail));
}

async function hydratePublicOrder(order: OrderRow): Promise<PublicOrder> {
  const { data: paymentAttempt, error: paymentError } = await getSupabaseAdmin()
    .from("ecommerce_payment_attempts")
    .select("capture_method, installments, status, created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new Error("order_payment_read_failed");
  }

  const items: PublicOrderItem[] = [...(order.ecommerce_order_items ?? [])]
    .sort((left, right) => left.line_number - right.line_number)
    .map((item) => ({
      productSlug: item.product_slug,
      productName: item.product_name,
      productImage: item.product_image,
      category: item.category,
      material: item.material,
      unitPriceCents: Number(item.unit_price_cents),
      quantity: item.quantity,
      subtotalCents: Number(item.subtotal_cents),
      customization: publicOrderStone(item.customization)
    }));

  const captureMethod = paymentAttempt?.capture_method;
  return {
    orderNumber: order.order_number,
    createdAt: order.created_at,
    paymentStatus: order.payment_status,
    statusStage: getOrderPresentationStage({
      deliveryMethod: order.delivery_method,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status
    }),
    deliveryMethod: order.delivery_method,
    shippingAddress: null,
    shippingCarrier: order.shipping_carrier,
    shippingService: order.shipping_service,
    shippingDeadlineDays: order.shipping_deadline_days,
    trackingCode: null,
    subtotalCents: Number(order.subtotal_cents),
    shippingCents: Number(order.shipping_cents),
    discountCents: Number(order.discount_cents),
    totalCents: Number(order.total_cents),
    paidAt: order.paid_at,
    paymentMethod:
      captureMethod === "pix" || captureMethod === "credit_card" ? captureMethod : null,
    installments:
      typeof paymentAttempt?.installments === "number" ? paymentAttempt.installments : null,
    receiptUrl: null,
    items
  };
}

export async function getPublicOrder(publicToken: string): Promise<PublicOrder | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("ecommerce_orders")
    .select(PUBLIC_ORDER_SELECT)
    .eq("public_token", publicToken)
    .maybeSingle();

  if (error) {
    throw new Error("order_read_failed");
  }
  if (!data) {
    return null;
  }

  return hydratePublicOrder(data as unknown as OrderRow);
}

export async function getPublicOrderByCustomer(
  orderNumber: string,
  email: string
): Promise<PublicOrder | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("ecommerce_orders")
    .select("id, customer_email")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    throw new Error("order_lookup_failed");
  }
  if (!data) {
    return null;
  }

  const identity = data as unknown as { id: string; customer_email: string };
  if (!emailsMatch(identity.customer_email, email)) {
    return null;
  }

  const { data: order, error: orderError } = await getSupabaseAdmin()
    .from("ecommerce_orders")
    .select(PUBLIC_ORDER_SELECT)
    .eq("id", identity.id)
    .maybeSingle();

  if (orderError) {
    throw new Error("order_read_failed");
  }
  if (!order) {
    return null;
  }

  return hydratePublicOrder(order as unknown as OrderRow);
}
