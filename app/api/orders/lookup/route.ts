import { NextResponse } from "next/server";
import {
  ORDER_TRACKING_ACCESS_SECONDS, ORDER_TRACKING_COOKIE, ORDER_TRACKING_PATH, orderTrackingLookupSchema
} from "@/lib/orders/tracking";
import { consumeOrderLookup } from "@/lib/orders/tracking-limit";
import { getVerifiedOrderAccessToken } from "@/lib/orders/tracking-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const MAX_BODY_BYTES = 1024;

function orderNotFound() {
  return NextResponse.json(
    { error: "Não foi possível localizar um pedido com esses dados.", code: "order_not_found" },
    { status: 404, headers }
  );
}

function rateLimited(retryAfter: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um instante e tente novamente.", code: "order_lookup_rate_limited" },
    { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } }
  );
}

async function readLookupBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
      request.headers.get("sec-fetch-site") === "cross-site" || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let value = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return JSON.parse(value + decoder.decode()) as unknown;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      value += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const workerWait = consumeOrderLookup();
  if (workerWait) return rateLimited(workerWait);
  const parsed = orderTrackingLookupSchema.safeParse(await readLookupBody(request));
  if (!parsed.success) return orderNotFound();

  const { orderNumber, phone } = parsed.data;
  const orderWait = consumeOrderLookup(orderNumber);
  if (orderWait) return rateLimited(orderWait);
  try {
    const token = await getVerifiedOrderAccessToken(orderNumber, phone);
    if (!token) return orderNotFound();
    const response = new NextResponse(null, { status: 204, headers });
    response.cookies.set(ORDER_TRACKING_COOKIE, token, {
      path: ORDER_TRACKING_PATH, httpOnly: true, sameSite: "strict",
      secure: process.env.NODE_ENV === "production", maxAge: ORDER_TRACKING_ACCESS_SECONDS
    });
    return response;
  } catch {
    console.error("Public order lookup is temporarily unavailable");
    return NextResponse.json(
      { error: "Não foi possível consultar o pedido agora. Tente novamente em instantes.", code: "order_lookup_unavailable" },
      { status: 503, headers }
    );
  }
}
