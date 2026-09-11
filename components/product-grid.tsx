import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import type { Product } from "@/types/product";

export function ProductGrid({
  products,
  emptyMessage = "Nenhum produto encontrado com os filtros selecionados.",
  itemListName = "Produtos",
  source = "product_grid"
}: {
  products: Product[];
  emptyMessage?: string;
  itemListName?: string;
  source?: string;
}) {
  if (products.length === 0) {
    return (
      <Reveal>
        <div className="rounded-lg border border-dashed border-black/20 bg-white p-8 text-center text-taupe">
          {emptyMessage}
        </div>
      </Reveal>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product, index) => (
        <Reveal key={product.id} delay={Math.min(index, 5) * 60} distance={16} className="h-full">
          <ProductCard product={product} itemListName={itemListName} source={source} />
        </Reveal>
      ))}
    </div>
  );
}