import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types/product";

export function ProductGrid({
  products,
  emptyMessage = "Nenhum produto encontrado com os filtros selecionados."
}: {
  products: Product[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/20 bg-white p-8 text-center text-taupe">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
