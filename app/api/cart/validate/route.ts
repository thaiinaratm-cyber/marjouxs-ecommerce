import { NextResponse } from "next/server";
import { resolveCheckoutCart } from "@/lib/checkout/catalog";
import { apiError, validationError } from "@/lib/checkout/http";
import { cartValidationRequestSchema } from "@/lib/checkout/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = cartValidationRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    return NextResponse.json(resolveCheckoutCart(parsed.data.items));
  } catch (error) {
    return apiError(error);
  }
}
