import { resolveAuthoritativeCheckoutCart } from "@/lib/checkout/catalog-server";
import { apiError, checkoutJson, validationError } from "@/lib/checkout/http";
import { cartValidationRequestSchema } from "@/lib/checkout/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = cartValidationRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    return checkoutJson(await resolveAuthoritativeCheckoutCart(parsed.data.items, "report"));
  } catch (error) {
    return apiError(error);
  }
}
