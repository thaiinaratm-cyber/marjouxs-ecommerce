import { NextResponse } from "next/server";
import { createCheckout } from "@/lib/checkout/create-checkout";
import { getPublicSiteUrl } from "@/lib/checkout/config";
import {
  logCheckoutFailure,
  requestValidationError,
  toCheckoutProcessError
} from "@/lib/checkout/diagnostics";
import { createCheckoutSchema } from "@/lib/checkout/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const failure = requestValidationError([]);
    logCheckoutFailure(failure);
    return NextResponse.json(
      { error: failure.publicMessage, code: failure.publicCode },
      { status: failure.status }
    );
  }

  const parsed = createCheckoutSchema.safeParse(payload);
  if (!parsed.success) {
    const failure = requestValidationError(parsed.error.issues.map((issue) => issue.path));
    logCheckoutFailure(failure);
    return NextResponse.json(
      { error: failure.publicMessage, code: failure.publicCode },
      { status: failure.status }
    );
  }

  try {
    const result = await createCheckout(parsed.data, getPublicSiteUrl(new URL(request.url).origin));
    return NextResponse.json(result);
  } catch (error) {
    const failure = toCheckoutProcessError(error);
    logCheckoutFailure(failure);
    return NextResponse.json(
      { error: failure.publicMessage, code: failure.publicCode },
      { status: failure.status }
    );
  }
}
