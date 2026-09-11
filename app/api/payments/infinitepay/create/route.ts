import { NextResponse } from "next/server";
import { createCheckout } from "@/lib/checkout/create-checkout";
import { getPublicSiteUrl } from "@/lib/checkout/config";
import { apiError, validationError } from "@/lib/checkout/http";
import { InfinitePayError } from "@/lib/checkout/infinitepay";
import { createCheckoutSchema } from "@/lib/checkout/schemas";
import { ShippingProviderError } from "@/lib/checkout/shipping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = createCheckoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    const result = await createCheckout(parsed.data, getPublicSiteUrl(new URL(request.url).origin));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InfinitePayError || error instanceof ShippingProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return apiError(error);
  }
}
