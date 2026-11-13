import { z } from "zod";
import { customizationLines, money, orderDate } from "@/lib/orders/model";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";

// Allowlist the purchase snapshot needed by this notification, never CPF or provider secrets.
export const orderEmailSnapshotSchema = z.object({
  id: z.string().uuid(), order_number: z.string(), created_at: z.string(),
  customer_name: z.string(), customer_email: z.string(), customer_phone: z.string(),
  total_cents: z.coerce.number().int().nonnegative(), payment_status: z.literal("paid"),
  payment_provider: z.string(), payment_method: z.string().nullable(), paid_at: z.string(),
  delivery_method: z.enum(["pickup", "shipping"]), shipping_city: z.string().nullable(),
  shipping_state: z.string().nullable(), shipping_carrier: z.string().nullable(),
  shipping_service: z.string().nullable(), shipping_cents: z.coerce.number().int().nonnegative(),
  // Preserve compatibility with frozen outbox snapshots created before these fields were selected.
  shipping_zip: z.string().nullable().optional().default(null),
  shipping_deadline_days: z.number().int().nonnegative().nullable().optional().default(null),
  ecommerce_order_items: z.array(z.object({
    line_number: z.number().int(), product_name: z.string(), category: z.string(),
    material: z.string().nullable(), quantity: z.number().int().positive(),
    unit_price_cents: z.coerce.number().int().nonnegative(), subtotal_cents: z.coerce.number().int().nonnegative(),
    customization: z.unknown()
  }))
});
type OrderEmailSnapshot = Omit<z.infer<typeof orderEmailSnapshotSchema>, "payment_status" | "paid_at" | "shipping_zip" | "shipping_deadline_days"> & {
  payment_status: string; paid_at: string | null;
  shipping_zip?: string | null; shipping_deadline_days?: number | null;
};

export type NotificationMessage = { from: string; to: string[]; subject: string; html: string; text: string };
export class OrderNotificationError extends Error {
  constructor(readonly code: string) { super(code); this.name = "OrderNotificationError"; }
}
export function orderNotificationsEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ORDER_NOTIFICATIONS_ENABLED === "true";
}
export function getOrderNotificationConfig(env: Record<string, string | undefined> = process.env) {
  if (!orderNotificationsEnabled(env)) return null;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.ORDER_NOTIFICATION_FROM?.trim() ?? "";
  const to = Array.from(new Set((env.ORDER_NOTIFICATION_EMAIL ?? "").split(/[,;]/).map((item) => item.trim()).filter(Boolean)));
  const fromEmail = from.match(/<([^<>]+)>$/)?.[1] ?? from;
  if (!apiKey || /[\r\n]/.test(from) || !z.string().email().safeParse(fromEmail).success ||
      to.length === 0 || to.length > 50 || to.some((email) => !z.string().email().safeParse(email).success)) {
    throw new OrderNotificationError("notification_configuration_invalid");
  }
  let site: URL;
  try { site = new URL(env.NEXT_PUBLIC_SITE_URL?.trim() || "https://marjouxsjoias.com.br"); }
  catch { throw new OrderNotificationError("notification_site_url_invalid"); }
  if (!["http:", "https:"].includes(site.protocol) || site.username || site.password ||
      (env.NODE_ENV === "production" && (site.protocol !== "https:" || /^(localhost|127\.|\[::1\])/.test(site.hostname)))) {
    throw new OrderNotificationError("notification_site_url_invalid");
  }
  return { apiKey, from, to, siteUrl: site.origin };
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
export function buildOrderPaidEmail(order: OrderEmailSnapshot, config: { from: string; to: string[]; siteUrl: string }): NotificationMessage {
  if (order.payment_status !== "paid" || !order.paid_at) throw new OrderNotificationError("notification_order_not_paid");
  const url = `${config.siteUrl}/admin/pedidos/${encodeURIComponent(order.id)}`;
  const subject = `Nova venda paga — Pedido #${order.order_number} — Marjouxs`;
  const method = order.payment_method === "pix" ? "Pix" : order.payment_method === "credit_card" ? "Cartão de crédito" : null;
  const delivery = order.delivery_method === "pickup" ? ["Retirada na loja"] : ["Entrega",
    [order.shipping_city, order.shipping_state].filter(Boolean).join("/"),
    order.shipping_zip ? `CEP ${order.shipping_zip}` : null,
    [order.shipping_carrier, order.shipping_service].filter(Boolean).join(" · "), `Frete: ${money(order.shipping_cents)}`,
    Number.isSafeInteger(order.shipping_deadline_days) && Number(order.shipping_deadline_days) >= 0
      ? `Transporte estimado: ${order.shipping_deadline_days} dias úteis` : null,
    `Confecção: ${JEWELRY_PRODUCTION_DEADLINE}`, "Postagem manual"].filter((line): line is string => Boolean(line));
  const heading = [`Pedido: #${order.order_number}`, `Cliente: ${order.customer_name}`, `Telefone: ${order.customer_phone}`,
    `E-mail: ${order.customer_email}`, `Valor: ${money(order.total_cents)}`];
  const payment = [order.payment_provider === "infinitepay" ? "InfinitePay" : order.payment_provider,
    ...(method ? [`Método: ${method}`] : []), `Pago em: ${orderDate(order.paid_at)}`];
  const items = [...order.ecommerce_order_items].sort((a, b) => a.line_number - b.line_number).map((item) => [
    `${item.quantity}x ${item.product_name}`, ...(item.material ? [`Material: ${item.material}`] : []),
    `Valor unitário: ${money(item.unit_price_cents)}`, `Total: ${money(item.subtotal_cents)}`, ...customizationLines(item)
  ]);
  const paragraphs = (lines: string[]) => lines.map((line) => `<p style="margin:6px 0;white-space:pre-wrap">${escapeHtml(line)}</p>`).join("");
  return { from: config.from, to: config.to, subject,
    text: ["NOVA VENDA PAGA", heading.join("\n"), `Pagamento:\n${payment.join("\n")}`, `Entrega:\n${delivery.join("\n")}`,
      `Itens:\n${items.map((lines) => lines.join("\n")).join("\n\n")}`, `Ver pedido no painel: ${url}`].join("\n\n"),
    html: `<html lang="pt-BR"><body style="margin:0;background:#faf9f7;color:#242424;font:15px/1.6 Arial,sans-serif"><main style="max-width:640px;margin:auto;padding:32px 24px"><p style="color:#927242;font-size:12px">MARJOUXS</p><h1 style="font-size:24px">Nova venda paga</h1>${paragraphs(heading)}<h2 style="font-size:18px">Pagamento</h2>${paragraphs(payment)}<h2 style="font-size:18px">Entrega</h2>${paragraphs(delivery)}<h2 style="font-size:18px">Itens</h2>${items.map((lines) => `<section style="border-top:1px solid #dedbd5;padding:12px 0">${paragraphs(lines)}</section>`).join("")}<p style="margin-top:24px"><a style="display:inline-block;background:#242424;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px" href="${escapeHtml(url)}">Ver pedido no painel</a></p></main></body></html>` };
}
