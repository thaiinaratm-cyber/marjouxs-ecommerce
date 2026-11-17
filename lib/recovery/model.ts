import { z } from "zod";
import { normalizeBrazilianPhoneDigits } from "@/lib/checkout/checkout-form";
import { cartCustomizationSchema, cartLineSchema } from "@/lib/checkout/schemas";
import { MAX_CHECKOUT_UNITS } from "@/lib/checkout/limits";
import { canonicalCheckoutJson } from "@/lib/checkout/intent";
import type { ValidatedCart } from "@/types/checkout";

export const recoveryStatuses = ["active", "abandoned", "converted", "expired", "ignored", "review"] as const;
export type RecoveryStatus = typeof recoveryStatuses[number];
export const recoveryLabels: Record<RecoveryStatus, string> = {
  active: "Ativo", abandoned: "Abandonado", converted: "Convertido",
  expired: "Expirado", ignored: "Ignorado", review: "Pagamento em revis\u00e3o"
};
export const stageLabels = { checkout_started: "Checkout iniciado", payment_link: "Link de pagamento criado" } as const;
export const recoveryDays = 30;

export const recoveryPhoneSchema = z.string().trim().max(32)
  .regex(/^(?:\+55[\s(.-]*[\d().\s-]+|[\d().\s-]+)$/)
  .refine(value => {
    const digits = value.replace(/\D/g, "");
    return value.startsWith("+") || digits.length > 11
      ? /^55\d{10,11}$/.test(digits) : /^\d{10,11}$/.test(digits);
  }).transform(normalizeBrazilianPhoneDigits);

const recoveryLine = cartLineSchema.omit({ displayedUnitPriceCents: true });
export const recoveryInputSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().positive().safe(),
  phone: recoveryPhoneSchema,
  name: z.string().trim().max(160).transform(value => value || null),
  contactAllowed: z.boolean(),
  deliveryMethod: z.enum(["pickup", "shipping"]),
  items: z.array(recoveryLine).max(50).refine(lines => lines.reduce((sum, line) => sum + line.quantity, 0) <= MAX_CHECKOUT_UNITS),
  requestId: z.uuidv4().optional()
}).strict().refine(input => input.items.length > 0 || !input.requestId);

export const savedRecoveryItemSchema = z.object({
  productId: z.string(), name: z.string(), quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(), customization: cartCustomizationSchema
});
export type RecoveryItem = z.infer<typeof savedRecoveryItemSchema>;

export function recoverySnapshot(cart: ValidatedCart) {
  return cart.items.map(({ productId, name, quantity, unitPriceCents, customization }) =>
    ({ productId, name, quantity, unitPriceCents, customization }))
    .sort((a, b) => canonicalCheckoutJson(a).localeCompare(canonicalCheckoutJson(b)));
}

export function recoveryWhatsapp(phone: string | null, allowed: boolean, status: RecoveryStatus) {
  if (!allowed || !phone || status !== "abandoned" || !/^\d{10,11}$/.test(phone)) return null;
  const message = "Ol\u00e1, tudo bem? Aqui \u00e9 da Marjouxs. Estamos \u00e0 disposi\u00e7\u00e3o para ajudar com a sua compra.";
  return `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
}
