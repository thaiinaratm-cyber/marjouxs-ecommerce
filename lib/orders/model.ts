import { ringPairCustomizationSchema } from "@/lib/checkout/schemas";
import { publicOrderStone, stoneColorLabel } from "@/lib/stone-customization";
import { formatCurrency } from "@/lib/format";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";

export const orderStatusLabels = {
  pending_payment: "Aguardando pagamento", payment_failed: "Pagamento falhou",
  requires_review: "Revisão necessária", paid: "Pago / Novo", preparing: "Em produção",
  ready_for_pickup: "Pronto", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado"
} as const;
export type OrderStatus = keyof typeof orderStatusLabels;
export const paymentStatusLabels: Record<string, string> = {
  pending: "Aguardando pagamento", paid: "Pago", failed: "Falhou", requires_review: "Revisão necessária"
};
export const operationalStatuses: OrderStatus[] = ["paid", "preparing", "ready_for_pickup", "shipped", "completed", "cancelled"];
export type OrderSummary = {
  id: string; order_number: string; created_at: string; updated_at: string;
  customer_name: string; customer_email: string; customer_phone: string;
  total_cents: number; payment_status: string; order_status: OrderStatus;
  payment_provider: string; payment_method: string | null; paid_at: string | null;
  delivery_method: "pickup" | "shipping"; shipping_carrier: string | null; shipping_service: string | null;
};
export type OrderItemSnapshot = {
  id: string; line_number: number; product_id: string; product_slug: string;
  product_name: string; product_image: string; category: string; subcategory: string | null;
  material: string | null; availability: string; unit_price_cents: number; quantity: number;
  subtotal_cents: number; customization: unknown;
};
export type PaymentSnapshot = {
  id: string; provider: string; order_nsu: string; provider_checkout_id: string | null;
  transaction_nsu: string | null; status: string; requested_amount_cents: number;
  paid_amount_cents: number | null; capture_method: string | null; installments: number | null;
  confirmed_at: string | null; created_at: string; failure_code?: string | null;
};
export type OrderSnapshot = OrderSummary & {
  customer_cpf?: string | null; subtotal_cents: number; discount_cents: number; shipping_cents: number;
  shipping_zip: string | null; shipping_street: string | null; shipping_number: string | null;
  shipping_complement: string | null; shipping_neighborhood: string | null;
  shipping_city: string | null; shipping_state: string | null; shipping_provider: string | null;
  shipping_service_id?: string | null; shipping_quoted_at?: string | null; shipping_deadline_days?: number | null;
  ecommerce_order_items: OrderItemSnapshot[]; ecommerce_payment_attempts?: PaymentSnapshot[];
};
export const money = (cents: number) => formatCurrency(Number(cents) / 100);
export function orderDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
export function isOrderStatus(value: string): value is OrderStatus {
  return Object.prototype.hasOwnProperty.call(orderStatusLabels, value);
}
export function canSetOrderStatus(order: Pick<OrderSummary, "payment_status" | "delivery_method" | "order_status">, status: OrderStatus) {
  if (!operationalStatuses.includes(status)) return false;
  if (status !== "cancelled" && order.payment_status !== "paid") return false;
  if (status === "shipped" && order.delivery_method === "pickup") return false;
  if (status === "ready_for_pickup" && order.delivery_method !== "pickup") return false;
  if (["cancelled", "completed"].includes(order.order_status)) return status === order.order_status;
  if (status === "cancelled") return true;
  // Permit forward operational steps, never reopen a terminal order or regress its progress.
  const progress: OrderStatus[] = ["paid", "preparing", "ready_for_pickup", "shipped", "completed"];
  return progress.indexOf(status) >= progress.indexOf(order.order_status);
}
export function customerWhatsapp(order: Pick<OrderSummary, "customer_phone" | "customer_name" | "order_number">) {
  let phone = order.customer_phone.replace(/\D/g, "");
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${order.customer_name}. Aqui é da Marjouxs. Estamos falando sobre seu pedido #${order.order_number}.`)}`;
}
export function customizationLines(item: Pick<OrderItemSnapshot, "category" | "customization">): string[] {
  const parsed = ringPairCustomizationSchema.safeParse(item.customization);
  const label = stoneColorLabel(publicOrderStone(item.customization)?.stone_color);
  const stoneLine = label ? ["Pedra: " + label] : [];
  if (item.category === "Alianças" && parsed.success) {
    return ["Venda por par", `Aliança 1 — Aro: ${parsed.data.ring1.size}`,
      ...(parsed.data.ring1.engraving ? [`Gravação 1: ${parsed.data.ring1.engraving}`] : []),
      `Aliança 2 — Aro: ${parsed.data.ring2.size}`,
      ...(parsed.data.ring2.engraving ? [`Gravação 2: ${parsed.data.ring2.engraving}`] : []), ...stoneLine];
  }
  if (parsed.success || !item.customization || typeof item.customization !== "object") return [];
  return [...stoneLine, ...Object.entries(item.customization).flatMap(([key, value]) =>
    ["string", "number", "boolean"].includes(typeof value) && key !== "type" && key !== "stone_color" ? [`${key}: ${String(value)}`] : [])];
}
export function deliveryLines(order: OrderSnapshot) {
  if (order.delivery_method === "pickup") return ["Retirada na loja"];
  return ["Entrega", [order.shipping_street, order.shipping_number].filter(Boolean).join(", "),
    order.shipping_complement, order.shipping_neighborhood,
    [order.shipping_city, order.shipping_state].filter(Boolean).join("/"),
    order.shipping_zip ? `CEP ${order.shipping_zip}` : null,
    [order.shipping_carrier, order.shipping_service].filter(Boolean).join(" · "),
    `Frete cobrado: ${money(order.shipping_cents)}`,
    Number.isSafeInteger(order.shipping_deadline_days) && Number(order.shipping_deadline_days) >= 0
      ? `Transporte estimado: ${order.shipping_deadline_days} dias úteis` : null,
    `Confecção: ${JEWELRY_PRODUCTION_DEADLINE}`,
    "Postagem manual", `Status: ${orderStatusLabels[order.order_status]}`].filter((line): line is string => Boolean(line));
}
export const ORDERS_PAGE_SIZE = 20;
export function parseOrderQuery(params: Record<string, string | string[] | undefined>) {
  const raw = typeof params.q === "string" ? params.q : "";
  // PostgREST filter grammar must never be supplied by the search input.
  const search = raw.normalize("NFC").replace(new RegExp("[^\\p{L}\\p{N}@+._\\s-]", "gu"), " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const status = typeof params.status === "string" && isOrderStatus(params.status) ? params.status : "";
  const page = Math.max(1, Math.min(100000, Number.isInteger(Number(params.page)) ? Number(params.page) : 1));
  return { search, status, page, from: (page - 1) * ORDERS_PAGE_SIZE, to: page * ORDERS_PAGE_SIZE - 1 };
}
