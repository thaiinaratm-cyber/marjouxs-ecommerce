import { ArrowRight } from "lucide-react";
import { AnalyticsLink } from "@/components/analytics-link";
import { ProductImage } from "@/components/product-image";
import { ProductPrice } from "@/components/product-price";
import { createSelectItemEvent } from "@/lib/analytics";
import type { Product } from "@/types/product";

function getProductBadge(product: Product) {
  if (product.featured) {
    return "Destaque";
  }

  return null;
}

export function ProductCard({
  product,
  itemListName = "Produtos",
  source = "product_grid"
}: {
  product: Product;
  itemListName?: string;
  source?: string;
}) {
  const badge = getProductBadge(product);
  const selectItemEvent = createSelectItemEvent(product, itemListName, source);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-soft">
      <AnalyticsLink
        href={`/produtos/${product.slug}`}
        analyticsEvents={selectItemEvent}
        className="block"
        aria-label={`Ver produto ${product.name}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-champagne">
          <ProductImage
            src={product.images?.[0]}
            alt={product.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {badge ? (
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink shadow-sm ring-1 ring-black/10">
                {badge}
              </span>
            ) : null}
            {product.stockStatus === "Sob encomenda" ? (
              <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                Sob encomenda
              </span>
            ) : null}
          </div>
        </div>
      </AnalyticsLink>

      <div className="flex min-h-[15.5rem] flex-1 flex-col p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{product.category}</p>
          <AnalyticsLink
            href={`/produtos/${product.slug}`}
            analyticsEvents={selectItemEvent}
            className="mt-2 line-clamp-2 block min-h-[3.5rem] font-serif text-xl font-semibold leading-snug text-ink transition hover:text-gold"
          >
            {product.name}
          </AnalyticsLink>
          <p className="mt-1 min-h-5 text-sm leading-5 text-taupe">{product.material}</p>
        </div>

        <div className="mt-4 grid flex-1 content-between gap-4">
          <ProductPrice product={product} compact />
          <AnalyticsLink
            href={`/produtos/${product.slug}`}
            analyticsEvents={selectItemEvent}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink bg-ink px-5 py-3 text-sm font-semibold uppercase text-white transition duration-300 hover:border-gold hover:bg-gold"
          >
            Ver produto <ArrowRight size={16} />
          </AnalyticsLink>
        </div>
      </div>
    </article>
  );
}