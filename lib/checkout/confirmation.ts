import { z } from "zod";
import { publicOrderStone } from "@/lib/stone-customization";
import type { PublicOrder } from "@/types/checkout";

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.string().refine(value => Number.isFinite(Date.parse(value)));
const item = z.object({
  productSlug: z.string().min(1), productName: z.string().min(1), productImage: z.string(),
  category: z.string(), material: z.string().nullable(), unitPriceCents: cents,
  quantity: z.number().int().positive(), subtotalCents: cents, customization: z.unknown().optional()
}).transform(value => ({ ...value, customization: publicOrderStone(value.customization) }));

// Explicit projection: even unexpected private fields in a response never reach this view.
const schema = z.object({
  orderNumber: z.string().regex(/^MJ-\d{6,}$/), createdAt: date,
  paymentStatus: z.enum(["paid", "pending", "requires_review", "failed"]),
  statusStage: z.enum(["received", "payment_approved", "production", "quality", "ready", "shipped", "delivered", "picked_up"]),
  deliveryMethod: z.enum(["pickup", "shipping"]), shippingCarrier: z.string().nullable(),
  shippingService: z.string().nullable(), shippingDeadlineDays: z.number().int().nonnegative().nullable(),
  subtotalCents: cents, shippingCents: cents, discountCents: cents, totalCents: cents.positive(),
  paidAt: date.nullable(), paymentMethod: z.enum(["pix", "credit_card"]).nullable(),
  installments: z.number().int().min(1).max(12).nullable(), items: z.array(item)
}).refine(value => value.paymentStatus !== "paid" || value.paidAt !== null)
  .transform(value => ({ ...value, shippingAddress: null, receiptUrl: null, trackingCode: null }));

export function parseConfirmationOrder(value: unknown): PublicOrder | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getConfirmationCopy(order: Pick<PublicOrder, "paymentStatus">) {
  switch (order.paymentStatus) {
    case "paid": return { title: "Pagamento aprovado", text: "Recebemos seu pagamento. A Marjouxs vai preparar seu pedido." };
    case "pending": return { title: "Aguardando confirmação", text: "Seu pagamento ainda está sendo confirmado. Você não precisa pagar novamente." };
    case "requires_review": return { title: "Seu pagamento está em verificação", text: "Seu pedido foi recebido. Nenhuma nova cobrança será iniciada automaticamente. Nossa equipe está disponível para orientar você." };
    case "failed": return { title: "Não foi possível confirmar este pagamento", text: "Fale com a Marjouxs para receber orientação. Nenhuma nova cobrança será iniciada automaticamente." };
  }
}

// Scoped to post-payment support as explicitly requested; other store contacts are unchanged.
export const CONFIRMATION_SUPPORT_WHATSAPP = "5511919964393";
export function confirmationSupportUrl(order: Pick<PublicOrder, "orderNumber" | "paymentStatus"> | null) {
  const labels = { paid: "pagamento aprovado", pending: "aguardando confirmação", requires_review: "pagamento em verificação", failed: "pagamento não confirmado" };
  const reference = order && /^MJ-\d{6,}$/.test(order.orderNumber) ? `Pedido: ${order.orderNumber}.\n` : "";
  const message = `${reference}Status: ${order ? labels[order.paymentStatus] : "consulta de pedido indisponível"}.`;
  return `https://wa.me/${CONFIRMATION_SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
