import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/checkout/http";
import { getPublicOrder } from "@/lib/checkout/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const token = z.string().uuid().safeParse(params.token);
    if (!token.success) {
      return NextResponse.json({ error: "Pedido não encontrado.", code: "order_not_found" }, { status: 404 });
    }

    const order = await getPublicOrder(token.data);
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado.", code: "order_not_found" }, { status: 404 });
    }

    return NextResponse.json(order, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
