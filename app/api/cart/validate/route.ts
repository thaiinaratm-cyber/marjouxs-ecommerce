import { NextResponse } from "next/server";
import { resolveAuthoritativeCheckoutCart } from "@/lib/checkout/catalog-server";
import { apiError, validationError } from "@/lib/checkout/http";
import { cartValidationRequestSchema } from "@/lib/checkout/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = cartValidationRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    return NextResponse.json(await resolveAuthoritativeCheckoutCart(parsed.data.items, "report"));
  } catch (error) {
    return apiError(error);
  }
}
