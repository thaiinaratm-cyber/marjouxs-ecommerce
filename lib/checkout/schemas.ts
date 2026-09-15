import { z } from "zod";

const engravingSchema = z.string().nullable().optional();

export const ringPairCustomizationSchema = z
  .object({
    type: z.literal("ring_pair"),
    ring1: z
      .object({
        size: z.number().int().min(8).max(35),
        engraving: engravingSchema
      })
      .strict(),
    ring2: z
      .object({
        size: z.number().int().min(8).max(35),
        engraving: engravingSchema
      })
      .strict()
  })
  .strict();

export const cartLineSchema = z
  .object({
    productId: z.string().trim().min(1).max(200),
    productSlug: z.string().trim().min(1).max(200),
    quantity: z.number().int().positive(),
    customization: ringPairCustomizationSchema.nullable()
  })
  .strict();

export const cartLinesSchema = z.array(cartLineSchema).min(1).max(50);

export const shippingLineSchema = cartLineSchema.omit({ customization: true });
export const shippingLinesSchema = z.array(shippingLineSchema).min(1).max(50);

export const postalCodeSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{8}$/));

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const customerSchema = z
  .object({
    name: requiredText(160),
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(z.string().min(10).max(13)),
    email: z.string().trim().email().max(254),
    cpf: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(z.union([z.literal(""), z.string().regex(/^\d{11}$/)]))
      .optional()
  })
  .strict();

export const shippingAddressSchema = z
  .object({
    postalCode: postalCodeSchema,
    street: requiredText(200),
    number: requiredText(40),
    complement: z.string().trim().max(120).optional().default(""),
    neighborhood: requiredText(120),
    city: requiredText(120),
    state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
    serviceId: requiredText(60),
    shippingQuoteId: z.string().uuid()
  })
  .strict();

export const analyticsIdentifiersSchema = z
  .object({
    clientId: z.string().trim().min(1).max(100).nullable(),
    sessionId: z.string().trim().regex(/^\d+$/).max(30).nullable()
  })
  .strict()
  .optional();

export const createCheckoutSchema = z
  .object({
    requestId: z.string().uuid(),
    items: cartLinesSchema,
    customer: customerSchema,
    delivery: z.discriminatedUnion("method", [
      z.object({ method: z.literal("pickup") }).strict(),
      z
        .object({
          method: z.literal("shipping"),
          address: shippingAddressSchema
        })
        .strict()
    ]),
    analytics: analyticsIdentifiersSchema
  })
  .strict();

export const shippingQuoteRequestSchema = z
  .object({
    postalCode: postalCodeSchema,
    items: shippingLinesSchema
  })
  .strict();

export const cartValidationRequestSchema = z
  .object({ items: cartLinesSchema })
  .strict();

export const infinitePayWebhookSchema = z
  .object({
    invoice_slug: z.string().trim().min(1).max(300),
    transaction_nsu: z.string().trim().min(1).max(300),
    order_nsu: z.string().trim().min(1).max(100),
    receipt_url: z.string().url().optional().nullable()
  })
  .passthrough();

export const orderLookupSchema = z
  .object({
    orderNumber: z
      .string()
      .trim()
      .toUpperCase()
      .transform((value) => value.replace(/\s+/g, ""))
      .transform((value) => (/^MJ\d+$/.test(value) ? value.replace(/^MJ/, "MJ-") : value))
      .pipe(z.string().regex(/^MJ-\d{6,12}$/)),
    email: z.string().trim().toLowerCase().email().max(254)
  })
  .strict();
