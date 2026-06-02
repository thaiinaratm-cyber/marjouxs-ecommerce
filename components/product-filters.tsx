"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { categories } from "@/data/categories";
import { normalizeText } from "@/lib/format";
import { normalizeSortOrder, sortProducts, type ProductSortOrder } from "@/lib/product-sorting";
import { ProductGrid } from "@/components/product-grid";
import { SortSelect } from "@/components/sort-select";
import type { Product } from "@/types/product";

function filterVisibleProducts({
  products,
  query,
  category,
  material
}: {
  products: Product[];
  query?: string;
  category?: string;
  material?: string;
}) {
  const normalizedQuery = normalizeText(query ?? "");

  return products.filter((product) => {
    const searchable = normalizeText(
      [product.name, product.category, product.subcategory, product.material, product.description].join(" ")
    );
    const matchesQuery = normalizedQuery ? searchable.includes(normalizedQuery) : true;
    const matchesCategory = category ? product.category === category : true;
    const matchesMaterial = material ? product.material === material : true;

    return matchesQuery && matchesCategory && matchesMaterial;
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
  const sortOrder = normalizeSortOrder(initialOrder);

  const filteredProducts = useMemo(
    () => sortProducts(filterVisibleProducts({ products, query, category, material }), sortOrder),
    [products, query, category, material, sortOrder]
  );

  return (
    <section className="grid gap-6">
      <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px_220px]">
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
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-taupe">{filteredProducts.length} itens encontrados em {products.length} cadastrados com imagem.</p>
        <SortSelect value={sortOrder} />
      </div>
      <ProductGrid
        products={filteredProducts}
        emptyMessage={query ? "Nenhum produto encontrado para sua busca." : undefined}
      />
    </section>
  );
}
