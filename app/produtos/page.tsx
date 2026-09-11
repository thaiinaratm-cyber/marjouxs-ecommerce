import { ProductFilters } from "@/components/product-filters";
import { Reveal } from "@/components/reveal";
import { normalizeSortOrder } from "@/lib/product-sorting";
import { getMaterials, getVisibleProducts } from "@/lib/products";

export const metadata = {
  title: "Produtos | Marjouxs Joalheria",
  description: "Explore joias, alianças, ouro 18k, prata e relógios da Marjouxs Joalheria. Use busca e filtros para encontrar a peça ideal.",
  alternates: {
    canonical: "https://marjouxsjoias.com.br/produtos"
  },
  openGraph: {
    title: "Produtos | Marjouxs Joalheria",
    description: "Explore joias, alianças, ouro 18k, prata e relógios da Marjouxs Joalheria.",
    url: "https://marjouxsjoias.com.br/produtos",
    siteName: "Marjouxs",
    locale: "pt_BR",
    type: "website"
  }
};

export default function ProductsPage({ searchParams }: { searchParams?: { busca?: string; ordem?: string } }) {
  const searchTerm = searchParams?.busca ?? "";
  const sortOrder = normalizeSortOrder(searchParams?.ordem);
  const visibleProducts = getVisibleProducts();
  const materials = getMaterials(visibleProducts);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Reveal>
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Catálogo</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Produtos e serviços Marjouxs</h1>
          <p className="mt-4 leading-7 text-taupe">
            Explore joias, alianças, relógios e serviços. Use os filtros para encontrar por categoria, material ou termo.
          </p>
        </div>
      </Reveal>
      <Reveal delay={80} distance={16}>
        <ProductFilters initialQuery={searchTerm} initialOrder={sortOrder} products={visibleProducts} materials={materials} />
      </Reveal>
    </section>
  );
}
