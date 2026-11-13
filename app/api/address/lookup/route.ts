import { NextResponse } from "next/server";
import { lookupPostalCode, PostalCodeError } from "@/lib/checkout/postal-code-lookup";
import { POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const postalCode =
    payload && typeof payload === "object" && "postalCode" in payload
      ? payload.postalCode
      : null;
  try {
    return NextResponse.json({ address: await lookupPostalCode(postalCode) });
  } catch (error) {
    if (error instanceof PostalCodeError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: POSTAL_CODE_MESSAGES.unavailable, code: "postal_code_service_unavailable" }, { status: 503 });
  }
}
