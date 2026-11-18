import { Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { getProductionDeadline, isPhysicalProduct } from "@/lib/product-merchandising";
import { hasValidPrice } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

export function ProductTrustBlock({ product }: { product: Product }) {
  if (!isPhysicalProduct(product) || (!hasValidPrice(product) && !product.allowWhatsappQuote)) return null;

  const production = getProductionDeadline(product);
  return (
    <aside aria-label="Produção e retirada" className="mt-5 border-t border-black/10 pt-4">
      <ul className="grid gap-3 text-sm leading-5 text-ink">
        {production ? (
          <li className="flex items-start gap-2.5">
            <Clock3 aria-hidden="true" className="mt-0.5 shrink-0 text-gold" size={17} strokeWidth={1.7} />
            <span>
              <strong>Produção: {production}</strong>
              <span className="mt-0.5 block text-taupe">O prazo de transporte é informado à parte na finalização.</span>
            </span>
          </li>
        ) : null}
        <li className="flex items-start gap-2.5">
          <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-gold" size={17} strokeWidth={1.7} />
          <Link href="/politica-de-entrega" className="font-medium underline decoration-gold underline-offset-4 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            Retirada em Arujá
          </Link>
        </li>
      </ul>
    </aside>
  );
}
