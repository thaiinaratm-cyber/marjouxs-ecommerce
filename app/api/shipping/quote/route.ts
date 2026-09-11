import { NextResponse } from "next/server";
import { resolveShipmentCart } from "@/lib/checkout/catalog";
import { apiError, validationError } from "@/lib/checkout/http";
import { shippingQuoteRequestSchema } from "@/lib/checkout/schemas";
import { quoteShipping, ShippingProviderError } from "@/lib/checkout/shipping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = shippingQuoteRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    const cart = resolveShipmentCart(parsed.data.items);
    const options = await quoteShipping(parsed.data.postalCode, cart.subtotalCents);
    return NextResponse.json({ options });
  } catch (error) {
    if (error instanceof ShippingProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return apiError(error);
  }
}
