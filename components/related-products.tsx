import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import type { Product } from "@/types/product";

export function RelatedProducts({ products, mode }: { products: Product[]; mode: "manual" | "automatic" }) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mt-14" aria-labelledby="related-products-title">
      <h2 id="related-products-title" className="mt-2 font-serif text-3xl font-semibold text-ink">
        {mode === "manual" ? "Combine com" : "Você também pode gostar"}
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product, index) => (
          <Reveal
            key={product.id}
            delay={Math.min(index, 3) * 60}
            distance={16}
            className="h-full min-w-0"
          >
            <ProductCard
              product={product}
              itemListName="Produtos relacionados"
              source="related_products"
              quoteAction
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
