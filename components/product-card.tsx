import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductImage } from "@/components/product-image";
import { ProductPrice } from "@/components/product-price";
import type { Product } from "@/types/product";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <Link href={`/produtos/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-champagne">
          <ProductImage
            src={product.images?.[0]}
            alt={product.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink">
            {product.stockStatus}
          </span>
        </div>
      </Link>
      <div className="grid gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{product.category}</p>
          <Link href={`/produtos/${product.slug}`} className="mt-1 block font-serif text-xl font-semibold text-ink">
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-taupe">{product.material}</p>
        </div>
        <ProductPrice product={product} compact />
        <AddToCartButton product={product} compact />
      </div>
    </article>
  );
}
