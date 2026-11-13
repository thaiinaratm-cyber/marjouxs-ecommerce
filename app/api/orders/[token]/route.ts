import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicOrder } from "@/lib/checkout/orders";
import { parseConfirmationOrder } from "@/lib/checkout/confirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };

export async function GET(_request: Request, { params: pendingParams }: { params: Promise<{ token: string }> }) {
  try {
    const params = await pendingParams;
    const token = z.uuidv4().safeParse(params.token);
    if (!token.success) {
      return NextResponse.json({ error: "Pedido não encontrado.", code: "order_not_found" }, { status: 404, headers });
    }

    const order = await getPublicOrder(token.data);
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado.", code: "order_not_found" }, { status: 404, headers });
    }

    const publicOrder = parseConfirmationOrder(order);
    if (!publicOrder) throw new Error("order_public_contract_invalid");
    return NextResponse.json(publicOrder, { headers });
  } catch {
    console.error("order_status_read_failure", { code: "order_read_unavailable" });
    return NextResponse.json({ error: "Não foi possível consultar o pedido agora.", code: "order_read_unavailable" },
      { status: 503, headers });
  }
}
