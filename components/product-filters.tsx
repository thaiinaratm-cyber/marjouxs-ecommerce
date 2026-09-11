"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { categories } from "@/data/categories";
import { normalizeText } from "@/lib/format";
import { trackSearch } from "@/lib/analytics";
import { hasValidPrice } from "@/lib/product-pricing";
import { normalizeSortOrder, sortProducts, type ProductSortOrder } from "@/lib/product-sorting";
import { ProductGrid } from "@/components/product-grid";
import { SortSelect } from "@/components/sort-select";
import type { Product } from "@/types/product";

type PriceRange = "" | "ate-500" | "500-1500" | "1500-3000" | "acima-3000";

const priceRanges: { label: string; value: PriceRange; min?: number; max?: number }[] = [
  { label: "Até R$ 500", value: "ate-500", max: 500 },
  { label: "R$ 500 a R$ 1.500", value: "500-1500", min: 500, max: 1500 },
  { label: "R$ 1.500 a R$ 3.000", value: "1500-3000", min: 1500, max: 3000 },
  { label: "Acima de R$ 3.000", value: "acima-3000", min: 3000 }
];

function matchesPriceRange(product: Product, priceRange: PriceRange) {
  if (!priceRange) {
    return true;
  }

  if (!hasValidPrice(product) || !product.price) {
    return false;
  }

  const range = priceRanges.find((item) => item.value === priceRange);

  if (!range) {
    return true;
  }

  const min = range.min ?? 0;
  const max = range.max ?? Number.POSITIVE_INFINITY;

  return product.price >= min && product.price <= max;
}

function filterVisibleProducts({
  products,
  query,
  category,
  material,
  priceRange
}: {
  products: Product[];
  query?: string;
  category?: string;
  material?: string;
  priceRange?: PriceRange;
}) {
  const normalizedQuery = normalizeText(query ?? "");

  return products.filter((product) => {
    const searchable = normalizeText(
      [product.name, product.category, product.subcategory, product.material, product.description].join(" ")
    );
    const matchesQuery = normalizedQuery ? searchable.includes(normalizedQuery) : true;
    const matchesCategory = category ? product.category === category : true;
    const matchesMaterial = material ? product.material === material : true;

    return matchesQuery && matchesCategory && matchesMaterial && matchesPriceRange(product, priceRange ?? "");
  });
}

export function ProductFilters({
  initialQuery = "",
  initialOrder = "relevantes",
  products,
  materials
}: {
  initialQuery?: string;
  initialOrder?: ProductSortOrder;
  products: Product[];
  materials: string[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [material, setMaterial] = useState("");
  const [priceRange, setPriceRange] = useState<PriceRange>("");
  const lastTrackedQuery = useRef(initialQuery.trim());
  const sortOrder = normalizeSortOrder(initialOrder);
  const hasActiveFilters = Boolean(query || category || material || priceRange);

  const filteredProducts = useMemo(
    () => sortProducts(filterVisibleProducts({ products, query, category, material, priceRange }), sortOrder),
    [products, query, category, material, priceRange, sortOrder]
  );

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2 || normalizedQuery === lastTrackedQuery.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      trackSearch(normalizedQuery, "products_page");
      lastTrackedQuery.current = normalizedQuery;
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setMaterial("");
    setPriceRange("");
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Filtrar produtos</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/10 px-3 text-xs font-semibold text-ink transition hover:border-gold hover:text-gold"
            >
              <X size={14} /> Limpar filtros
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px_200px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por joia, material ou serviço"
              className="h-12 w-full rounded-md border border-black/10 bg-pearl pl-10 pr-4 text-sm outline-none transition focus:border-gold"
            />
          </label>
          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe" size={18} />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-12 w-full rounded-md border border-black/10 bg-pearl pl-10 pr-4 text-sm outline-none transition focus:border-gold"
            >
              <option value="">Todas as categorias</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <select
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            className="h-12 w-full rounded-md border border-black/10 bg-pearl px-4 text-sm outline-none transition focus:border-gold"
          >
            <option value="">Todos os materiais</option>
            {materials.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={priceRange}
            onChange={(event) => setPriceRange(event.target.value as PriceRange)}
            className="h-12 w-full rounded-md border border-black/10 bg-pearl px-4 text-sm outline-none transition focus:border-gold"
          >
            <option value="">Todos os preços</option>
            {priceRanges.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-taupe">
          {filteredProducts.length} itens encontrados em {products.length} cadastrados com imagem.
        </p>
        <SortSelect value={sortOrder} />
      </div>
      <ProductGrid
        products={filteredProducts}
        emptyMessage={hasActiveFilters ? "Nenhum produto encontrado" : undefined}
        itemListName="Catálogo de produtos"
        source="products_page"
      />
    </section>
  );
}