import { z } from "zod";

export const ORDER_TRACKING_PATH = "/pedido/acompanhamento";
export const ORDER_TRACKING_COOKIE = "marjouxs_order_access";
export const ORDER_TRACKING_ACCESS_SECONDS = 30 * 60;

export function normalizeOrderPhone(value: string) {
  const input = value.trim();
  if (input.length > 32 || !/^\+?[\d().\s-]+$/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  if (input.startsWith("+") || digits.length > 11) {
    if (!/^55\d{10,11}$/.test(digits)) return null;
    digits = digits.slice(2);
  }
  return /^\d{10,11}$/.test(digits) ? digits : null;
}

export const orderTrackingLookupSchema = z.object({
  orderNumber: z.string().max(32).transform(value => value.trim().toUpperCase()
    .replace(/\s+/g, "").replace(/^MJ(?=\d)/, "MJ-")).pipe(z.string().regex(/^MJ-\d{6,12}$/)),
  phone: z.string().max(32).transform(normalizeOrderPhone).pipe(z.string())
}).strict();

export const orderAccessTokenSchema = z.uuidv4();
