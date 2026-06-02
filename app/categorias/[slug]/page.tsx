import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { SortSelect } from "@/components/sort-select";
import { normalizeSortOrder, sortProducts } from "@/lib/product-sorting";
import { getCategoryBySlug, getProductsByCategory } from "@/lib/products";
import type { Product } from "@/types/product";

const categoryFilters: Record<string, { label: string; slug: string }[]> = {
  aliancas: [
    { label: "Ouro 18k/750", slug: "ouro-18k-750" },
    { label: "Prata 950", slug: "prata-950" },
    { label: "Banhado a Ouro", slug: "banhado-a-ouro" },
    { label: "Moeda", slug: "moeda" }
  ],
  aneis: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" },
    { label: "Formatura", slug: "formatura" }
  ],
  brincos: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" },
    { label: "Infantil", slug: "infantil" }
  ],
  correntes: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 925", slug: "prata-925" }
  ],
  pulseiras: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 925", slug: "prata-925" },
    { label: "Infantil", slug: "infantil" }
  ]
};

function filterSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function searchableProductText(product: Product) {
  return [product.name, product.material, product.subcategory].map(filterSlug).join(" ");
}

function hasGold18k(product: Product) {
  const text = searchableProductText(product);
  const material = filterSlug(product.material);

  return material === "ouro-18k" || material === "ouro-18k-750" || text.includes("ouro") || text.includes("18k") || text.includes("750");
}

function hasSilver950(product: Product) {
  const text = searchableProductText(product);
  const material = filterSlug(product.material);

  return material === "prata-950" || text.includes("prata-950") || text.includes("prata-950") || text.includes("prata");
}

function hasSilver925(product: Product) {
  const text = searchableProductText(product);
  const material = filterSlug(product.material);

  return material === "prata-925" || text.includes("prata-925") || text.includes("prata");
}

function matchesProductFilter(product: Product, selectedFilter: string) {
  const text = searchableProductText(product);
  const material = filterSlug(product.material);
  const subcategory = filterSlug(product.subcategory);

  if (selectedFilter === "ouro-18k" || selectedFilter === "ouro-18k-750") {
    return hasGold18k(product);
  }

  if (selectedFilter === "prata-950") {
    return hasSilver950(product) || subcategory.includes("aliancas-prata") || subcategory.includes("aneis-em-prata");
  }

  if (selectedFilter === "prata-925") {
    return hasSilver925(product);
  }

  if (selectedFilter === "banhado-a-ouro") {
    return (
      material === "banhado-a-ouro" ||
      text.includes("banhado") ||
      text.includes("folheado") ||
      text.includes("banho-de-ouro") ||
      subcategory.includes("banhado-a-ouro")
    );
  }

  if (selectedFilter === "moeda") {
    return material === "moeda" || text.includes("moeda") || subcategory.includes("moeda");
  }

  if (selectedFilter === "formatura") {
    return text.includes("formatura") || subcategory.includes("formatura");
  }

  if (selectedFilter === "infantil") {
    return text.includes("infantil") || subcategory.includes("infantil");
  }

  return subcategory === selectedFilter;
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const category = getCategoryBySlug(params.slug);
  return {
    title: category ? `${category.name} | Antoér Joalheria` : "Categoria | Antoér Joalheria"
  };
}

export default function CategoryPage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: { subcategoria?: string; ordem?: string };
}) {
  const category = getCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = getProductsByCategory(category.name);
  const selectedSubcategory = searchParams?.subcategoria ?? "";
  const sortOrder = normalizeSortOrder(searchParams?.ordem);
  const filterOptions = categoryFilters[category.slug] ?? [];
  const filteredProducts = selectedSubcategory
    ? categoryProducts.filter((product) => matchesProductFilter(product, selectedSubcategory))
    : categoryProducts;
  const sortedProducts = sortProducts(filteredProducts, sortOrder);
  const buildCategoryHref = (subcategory?: string) => {
    const params = new URLSearchParams();

    if (subcategory) {
      params.set("subcategoria", subcategory);
    }
    if (sortOrder !== "relevantes") {
      params.set("ordem", sortOrder);
    }

    const query = params.toString();
    return query ? `/categorias/${category.slug}?${query}` : `/categorias/${category.slug}`;
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{category.name}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">{category.name} Antoér</h1>
        <p className="mt-4 leading-7 text-taupe">{category.description}</p>
      </div>
      {filterOptions.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={buildCategoryHref()}
            className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
              selectedSubcategory
                ? "border-black/10 bg-white text-ink hover:border-gold hover:text-gold"
                : "border-ink bg-ink text-white"
            }`}
          >
            Todos
          </Link>
          {filterOptions.map((filter) => {
            const isActive = selectedSubcategory === filter.slug;

            return (
              <Link
                key={filter.slug}
                href={buildCategoryHref(filter.slug)}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-black/10 bg-white text-ink hover:border-gold hover:text-gold"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      )}
      <div className="mb-5 flex justify-end">
        <SortSelect value={sortOrder} />
      </div>
      <ProductGrid
        products={sortedProducts}
        emptyMessage="Nenhum produto com imagem cadastrado nesta categoria."
      />
    </section>
  );
}
