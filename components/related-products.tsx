import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import type { Product } from "@/types/product";

export function RelatedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mt-14" aria-labelledby="related-products-title">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Continue descobrindo</p>
      <h2 id="related-products-title" className="mt-2 font-serif text-3xl font-semibold text-ink">
        Você também pode gostar
      </h2>

      <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {products.map((product, index) => (
          <Reveal
            key={product.id}
            delay={Math.min(index, 3) * 60}
            distance={16}
            className="h-full w-[82vw] max-w-[18rem] shrink-0 snap-start sm:w-auto sm:max-w-none"
          >
            <ProductCard
              product={product}
              itemListName="Produtos relacionados"
              source="related_products"
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
