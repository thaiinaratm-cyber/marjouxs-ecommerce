import { getVisibleProducts } from "@/lib/products";
import { getMerchantItems, renderMerchantXml } from "@/lib/google-merchant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Embed only public image paths during build; deployed functions need not
    // contain public/. Catalog and prices remain dynamic.
    const images: string[] = JSON.parse(process.env.MERCHANT_PRODUCT_IMAGES ?? "[]");
    const items = getMerchantItems(getVisibleProducts(), new Set(images));
    if (!items.length) throw new Error("Empty Merchant catalog");
    return new Response(renderMerchantXml(items), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" }
    });
  } catch {
    return new Response("Feed temporariamente indisponível.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" }
    });
  }
}
