"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OverlayDrawer } from "@/components/overlay-drawer";
import { ProductGrid } from "@/components/product-grid";
import { SortSelect } from "@/components/sort-select";
import { categories } from "@/data/categories";
import { trackSearch } from "@/lib/analytics";
import {
  filterCatalogProducts,
  getMaterialFilterOptions,
  normalizePriceRange,
  productPriceRanges
} from "@/lib/product-discovery";
import { normalizeSortOrder, sortProducts, type ProductSortOrder } from "@/lib/product-sorting";
import type { Product } from "@/types/product";

type ProductFiltersProps = {
  initialQuery?: string;
  initialOrder?: ProductSortOrder;
  initialCategory?: string;
  initialMaterial?: string;
  initialPriceRange?: string;
  products: Product[];
  showCategoryFilter?: boolean;
  itemListName?: string;
  source?: string;
  emptyMessage?: string;
};

export function ProductFilters({
  initialQuery = "",
  initialOrder = "relevantes",
  initialCategory = "",
  initialMaterial = "",
  initialPriceRange = "",
  products,
  showCategoryFilter = true,
  itemListName = "Catálogo de produtos",
  source = "products_page",
  emptyMessage = "Nenhum produto encontrado com os filtros selecionados."
}: ProductFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const urlQuery = searchParams.get("busca") ?? initialQuery;
  const category = showCategoryFilter
    ? searchParams.get("categoria") ?? initialCategory
    : "";
  const material = searchParams.get("material") ?? initialMaterial;
  const priceRange = normalizePriceRange(searchParams.get("preco") ?? initialPriceRange);
  const sortOrder = normalizeSortOrder(searchParams.get("ordem") ?? initialOrder);
  const [query, setQuery] = useState(urlQuery);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const lastTrackedQuery = useRef(urlQuery.trim());

  const categoryOptions = useMemo(
    () => categories
      .filter((categoryOption) => products.some((product) => product.category === categoryOption.name))
      .map((categoryOption) => ({ label: categoryOption.name, value: categoryOption.slug })),
    [products]
  );
  const materialOptions = useMemo(() => getMaterialFilterOptions(products), [products]);
  const showMaterialFilter = materialOptions.length > 1;
  const activeFacetCount = Number(Boolean(category)) + Number(Boolean(material)) + Number(Boolean(priceRange));
  const hasActiveFilters = Boolean(query.trim() || category || material || priceRange);

  const filteredProducts = useMemo(
    () => sortProducts(filterCatalogProducts({
      products,
      query,
      category,
      material,
      priceRange
    }), sortOrder),
    [products, query, category, material, priceRange, sortOrder]
  );

  const updateUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParamsString);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const nextQuery = params.toString();
    if (nextQuery !== searchParamsString) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParamsString]);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery === urlQuery.trim()) return;

    const timeoutId = window.setTimeout(() => {
      updateUrl({ busca: normalizedQuery });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [query, updateUrl, urlQuery]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2 || normalizedQuery === lastTrackedQuery.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      trackSearch(normalizedQuery, source);
      lastTrackedQuery.current = normalizedQuery;
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [query, source]);

  function clearFilters() {
    setQuery("");
    updateUrl({ busca: "", categoria: "", material: "", preco: "" });
  }

  function changeSortOrder(nextOrder: ProductSortOrder) {
    updateUrl({ ordem: nextOrder === "relevantes" ? "" : nextOrder });
  }

  function FilterFields({ mobile = false }: { mobile?: boolean }) {
    const fieldClass = mobile
      ? "h-12 w-full rounded-md border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/15"
      : "h-12 min-w-44 rounded-md border border-black/10 bg-pearl px-4 text-sm text-ink outline-none transition focus:border-gold";

    return (
      <>
        {showCategoryFilter && categoryOptions.length > 1 ? (
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {mobile ? "Categoria" : <span className="sr-only">Categoria</span>}
            <select
              value={category}
              onChange={(event) => updateUrl({ categoria: event.target.value })}
              className={fieldClass}
            >
              <option value="">Todas as categorias</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        {showMaterialFilter ? (
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {mobile ? "Material" : <span className="sr-only">Material</span>}
            <select
              value={material}
              onChange={(event) => updateUrl({ material: event.target.value })}
              className={fieldClass}
            >
              <option value="">Todos os materiais</option>
              {materialOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-semibold text-ink">
          {mobile ? "Faixa de preço" : <span className="sr-only">Faixa de preço</span>}
          <select
            value={priceRange}
            onChange={(event) => updateUrl({ preco: event.target.value })}
            className={fieldClass}
          >
            <option value="">Todos os preços</option>
            {productPriceRanges.map((range) => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>
        </label>
      </>
    );
  }

  const noResultsContent = query.trim() ? (
    <div>
      <p className="font-serif text-xl font-semibold text-ink">Não encontramos produtos para sua busca.</p>
      <p className="mt-2 text-sm leading-6 text-taupe">
        Verifique a escrita, navegue pelas categorias ou fale com nossa equipe.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/categorias" className="text-sm font-semibold text-ink transition hover:text-gold">
          Ver categorias
        </Link>
        <Link href="/contato" className="text-sm font-semibold text-ink transition hover:text-gold">
          Falar com a equipe
        </Link>
      </div>
    </div>
  ) : hasActiveFilters ? (
    <div>
      <p className="font-serif text-xl font-semibold text-ink">Não encontramos produtos com esses filtros.</p>
      <p className="mt-2 text-sm leading-6 text-taupe">
        Remova os filtros aplicados para ver outras opções do catálogo.
      </p>
      <button
        type="button"
        onClick={clearFilters}
        className="mt-4 text-sm font-semibold text-ink transition hover:text-gold"
      >
        Limpar filtros
      </button>
    </div>
  ) : emptyMessage;

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Encontre sua joia</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="hidden min-h-9 items-center gap-2 rounded-full border border-black/10 px-3 text-xs font-semibold text-ink transition hover:border-gold hover:text-gold md:inline-flex"
            >
              <X size={14} /> Limpar filtros
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:flex md:items-end">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Buscar produtos</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por joia, material ou categoria"
              className="h-12 w-full rounded-md border border-black/10 bg-pearl pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
            />
          </label>
          <div className="hidden gap-3 md:flex">
            <FilterFields />
          </div>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ink bg-white px-5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white md:hidden"
            aria-haspopup="dialog"
          >
            <SlidersHorizontal size={17} />
            Filtrar{activeFacetCount > 0 ? ` (${activeFacetCount})` : ""}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-taupe" aria-live="polite">
          {filteredProducts.length} {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}
        </p>
        <SortSelect value={sortOrder} onChange={changeSortOrder} />
      </div>

      <ProductGrid
        products={filteredProducts}
        emptyMessage={noResultsContent}
        itemListName={itemListName}
        source={source}
      />

      <OverlayDrawer
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        eyebrow="Refine sua escolha"
        title="Filtros"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 px-4 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-gold"
            >
              Ver {filteredProducts.length} {filteredProducts.length === 1 ? "produto" : "produtos"}
            </button>
          </div>
        }
      >
        <div className="grid gap-5">
          <FilterFields mobile />
        </div>
      </OverlayDrawer>
    </section>
  );
}
