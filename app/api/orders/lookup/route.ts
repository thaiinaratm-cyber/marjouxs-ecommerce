import { NextResponse } from "next/server";
import { getPublicOrderByCustomer } from "@/lib/checkout/orders";
import { orderLookupSchema } from "@/lib/checkout/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0"
};

function orderNotFound() {
  return NextResponse.json(
    {
      error: "Não encontramos um pedido com esses dados.",
      code: "order_not_found"
    },
    { status: 404, headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = orderLookupSchema.safeParse(body);
    if (!parsed.success) {
      return orderNotFound();
    }

    const order = await getPublicOrderByCustomer(parsed.data.orderNumber, parsed.data.email);
    if (!order) {
      return orderNotFound();
    }

    return NextResponse.json(order, { headers: noStoreHeaders });
  } catch {
    console.error("Public order lookup is temporarily unavailable");
    return NextResponse.json(
      {
        error: "Não foi possível consultar o pedido agora. Tente novamente em instantes.",
        code: "order_lookup_unavailable"
      },
      { status: 503, headers: noStoreHeaders }
    );
  }
}
