import type {
  PublicOrder,
  PublicOrderItem,
  PublicOrderStatusStage
} from "@/types/checkout";
import type { CartLine } from "@/types/product";

export type OrderTimelineState = "complete" | "current" | "upcoming";

export type OrderTimelineStep = {
  id: string;
  label: string;
  state: OrderTimelineState;
};

const shippingSteps = [
  ["received", "Pedido recebido"],
  ["payment_approved", "Pagamento aprovado"],
  ["production", "Em produção"],
  ["quality", "Controle de qualidade"],
  ["ready", "Pronto para envio"],
  ["shipped", "Enviado"],
  ["delivered", "Entregue"]
] as const;

const pickupSteps = [
  ["received", "Pedido recebido"],
  ["payment_approved", "Pagamento aprovado"],
  ["production", "Em produção"],
  ["quality", "Controle de qualidade"],
  ["ready", "Pronto para retirada"],
  ["picked_up", "Retirado"]
] as const;

const statusAliases: Record<string, PublicOrderStatusStage> = {
  pending: "received",
  pending_payment: "received",
  received: "received",
  order_received: "received",
  paid: "payment_approved",
  payment_approved: "payment_approved",
  payment_confirmed: "payment_approved",
  in_production: "production",
  production: "production",
  quality_control: "quality",
  ready_to_ship: "ready",
  ready_for_shipping: "ready",
  ready_for_pickup: "ready",
  shipped: "shipped",
  sent: "shipped",
  delivered: "delivered",
  picked_up: "picked_up",
  collected: "picked_up"
};

function normalizeStatus(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getOrderPresentationStage({
  deliveryMethod,
  orderStatus,
  paymentStatus
}: {
  deliveryMethod: PublicOrder["deliveryMethod"];
  orderStatus: string;
  paymentStatus: PublicOrder["paymentStatus"];
}): PublicOrderStatusStage {
  const steps = deliveryMethod === "pickup" ? pickupSteps : shippingSteps;
  if (paymentStatus !== "paid") return "received";

  const mappedStatus = statusAliases[normalizeStatus(orderStatus)];
  if (!mappedStatus || mappedStatus === "received") {
    return "payment_approved";
  }

  return mappedStatus && steps.some(([id]) => id === mappedStatus)
    ? mappedStatus
    : "payment_approved";
}

export function getOrderTimeline(order: Pick<PublicOrder, "deliveryMethod" | "statusStage">) {
  const steps = order.deliveryMethod === "pickup" ? pickupSteps : shippingSteps;
  const currentIndex = Math.max(
    0,
    steps.findIndex(([id]) => id === order.statusStage)
  );

  return steps.map(([id, label], index): OrderTimelineStep => ({
    id,
    label,
    state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming"
  }));
}

export function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

export function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}

export function getShippingAddressLines(address: NonNullable<PublicOrder["shippingAddress"]>) {
  return [
    `${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ""}`,
    `${address.neighborhood} - ${address.city}/${address.state}`,
    `CEP ${formatPostalCode(address.postalCode)}`
  ];
}

function customizationKey(customization: CartLine["customization"]) {
  if (customization?.type !== "ring_pair") return "standard";

  return [
    customization.ring1.size,
    customization.ring1.engraving?.trim() || "",
    customization.ring2.size,
    customization.ring2.engraving?.trim() || ""
  ].join("|");
}

function cartLineKey(line: Pick<CartLine, "productSlug" | "quantity" | "customization">) {
  return `${line.productSlug}|${line.quantity}|${customizationKey(line.customization)}`;
}

function orderItemKey(item: PublicOrderItem) {
  return `${item.productSlug}|${item.quantity}|${customizationKey(item.customization)}`;
}

export function shouldClearCartAfterPayment(
  paymentStatus: PublicOrder["paymentStatus"],
  cartLines: CartLine[],
  orderItems: PublicOrderItem[]
) {
  if (paymentStatus !== "paid" || cartLines.length === 0 || cartLines.length !== orderItems.length) {
    return false;
  }

  const cartKeys = cartLines.map(cartLineKey).sort();
  const orderKeys = orderItems.map(orderItemKey).sort();
  return cartKeys.every((key, index) => key === orderKeys[index]);
}
