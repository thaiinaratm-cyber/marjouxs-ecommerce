import { NextResponse } from "next/server";
import { z } from "zod";
import { recoverCheckoutIntent } from "@/lib/checkout/recover-intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
  // The high-entropy UUID is a read-only status capability; never return PII or payment URLs.
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ code: "checkout_recovery_unavailable" }, { status: 403, headers });
  }
  const parsed = z.object({ requestId: z.uuidv4() }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ state: "new" }, { headers });
  try {
    return NextResponse.json({ state: await recoverCheckoutIntent(parsed.data.requestId) }, { headers });
  } catch {
    console.error("checkout_recovery_failure", { code: "checkout_recovery_unavailable" });
    return NextResponse.json({ code: "checkout_recovery_unavailable" }, { status: 503, headers });
  }
}
