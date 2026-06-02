import { ProductFilters } from "@/components/product-filters";
import { normalizeSortOrder } from "@/lib/product-sorting";
import { getMaterials, getVisibleProducts } from "@/lib/products";

export const metadata = {
  title: "Produtos | Antoér Joalheria"
};

export default function ProductsPage({ searchParams }: { searchParams?: { busca?: string; ordem?: string } }) {
  const searchTerm = searchParams?.busca ?? "";
  const sortOrder = normalizeSortOrder(searchParams?.ordem);
  const visibleProducts = getVisibleProducts();
  const materials = getMaterials(visibleProducts);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Catálogo</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Produtos e serviços Antoér</h1>
        <p className="mt-4 leading-7 text-taupe">
          Explore joias, alianças, relógios e serviços. Use os filtros para encontrar por categoria, material ou termo.
        </p>
      </div>
      <ProductFilters initialQuery={searchTerm} initialOrder={sortOrder} products={visibleProducts} materials={materials} />
    </section>
  );
}
