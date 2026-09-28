import { NextRequest, NextResponse } from "next/server";
import { searchPublicProducts } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("busca")?.trim().slice(0, 120) ?? "";
  if (query.length < 2) return NextResponse.json({ products: [] });

  try {
    return NextResponse.json({ products: await searchPublicProducts(query, 6) });
  } catch {
    return NextResponse.json({ code: "catalog_unavailable" }, { status: 503 });
  }
}
