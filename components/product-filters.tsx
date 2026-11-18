import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { CatalogControls } from "@/components/catalog-controls";
import { ProductGrid } from "@/components/product-grid";
import { catalogHref, discoverCatalog } from "@/lib/catalog/discovery";

export function ProductFilters({
  discovery,
  pathname,
  itemListName = "Catálogo de produtos",
  source = "products_page",
  emptyMessage = "Nenhum produto disponível no momento."
}: {
  discovery: ReturnType<typeof discoverCatalog>;
  pathname: string;
  itemListName?: string;
  source?: string;
  emptyMessage?: string;
}) {
  const { chips, currentPage, options, pageCount, products, query, total } = discovery;
  const hasFilters = chips.length > 0 || query.ordem !== "relevantes";
  const pageLink = (page: number) => `${catalogHref(pathname, { ...query, pagina: String(page) })}#resultados`;
  const paginationStyle = "inline-flex min-h-11 items-center gap-1 rounded-md border border-black/15 px-2 text-sm font-semibold text-ink hover:border-gold focus-visible:ring-2 focus-visible:ring-gold sm:px-3";

  return (
    <section className="grid min-w-0 gap-5">
      <CatalogControls key={catalogHref(pathname, query)} options={options}
        pathname={pathname} query={query} filterCount={chips.length} source={source} />
      <div className="grid min-w-0 gap-2 scroll-mt-28" id="resultados">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm text-taupe">
            {total} {total === 1 ? "produto encontrado" : "produtos encontrados"}
          </p>
          {hasFilters ? (
            <Link href={pathname} scroll={false} prefetch={false} className="inline-flex min-h-9 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-gold">
              Limpar filtros
            </Link>
          ) : null}
        </div>
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap gap-2">
            {chips.map(({ label, remove }) => (
              <li key={Object.keys(remove)[0]} className="min-w-0 max-w-full">
                <Link href={catalogHref(pathname, { ...query, ...remove, pagina: undefined })} scroll={false} prefetch={false}
                  aria-label={`Remover filtro: ${label}`}
                  className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-ink hover:border-gold focus-visible:ring-2 focus-visible:ring-gold">
                  <span className="min-w-0 break-words">{label}</span><X aria-hidden="true" className="shrink-0" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <ProductGrid products={products} itemListName={itemListName} source={source}
        emptyMessage={hasFilters ? (
          <>
            <p className="font-serif text-xl font-semibold text-ink">Nenhum produto encontrado com esses filtros.</p>
            <Link href={pathname} scroll={false} prefetch={false} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-gold">Limpar filtros</Link>
          </>
        ) : emptyMessage} />
      {pageCount > 1 ? (
        <nav aria-label="Paginação de produtos" className="flex flex-wrap items-center justify-center gap-3">
          {currentPage > 1 ? (
            <Link className={paginationStyle} href={pageLink(currentPage - 1)} prefetch={false} rel="prev">
              <ChevronLeft aria-hidden="true" size={16} /> Anterior
            </Link>
          ) : null}
          <span aria-current="page" className="text-sm text-taupe">Página {currentPage} de {pageCount}</span>
          {currentPage < pageCount ? (
            <Link className={paginationStyle} href={pageLink(currentPage + 1)} prefetch={false} rel="next">
              Próxima <ChevronRight aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
