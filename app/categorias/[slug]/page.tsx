import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryViewTracker } from "@/components/analytics-trackers";
import { ProductGrid } from "@/components/product-grid";
import { Reveal } from "@/components/reveal";
import { SortSelect } from "@/components/sort-select";
import { normalizeSortOrder, sortProducts } from "@/lib/product-sorting";
import { getCategoryBySlug, getProductsByCategory } from "@/lib/products";
import { matchesRingMaterial } from "@/lib/ring-filters";
import type { Product } from "@/types/product";

const categoryFilters: Record<string, { label: string; slug: string; href?: string }[]> = {
  aliancas: [
    { label: "Ouro 18k/750", slug: "ouro-18k-750" },
    { label: "Prata 950", slug: "prata-950" },
    { label: "Banhado a Ouro", slug: "banhado-a-ouro" },
    { label: "Moeda", slug: "moeda" }
  ],
  aneis: [
    { label: "Ouro 18k", slug: "ouro-18k", href: "/aneis/ouro-18k" },
    { label: "Prata 950", slug: "prata-950", href: "/aneis/prata-950" }
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
  ],
  braceletes: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" }
  ],
  pingentes: [
    { label: "Ouro 18k", slug: "ouro-18k" },
    { label: "Prata 950", slug: "prata-950" }
  ]
};

function getCategorySeo(category: { name: string; slug: string; description: string }) {
  if (category.slug === "aliancas") {
    return {
      title: "Alianças | Marjouxs Joalheria em Arujá",
      description: "Encontre alianças em ouro, prata e outros modelos na Marjouxs Joalheria. Consulte numeração, gravação e condições pelo WhatsApp."
    };
  }

  if (category.slug === "aneis") {
    return {
      title: "Anéis | Marjouxs Joalheria",
      description: "Anéis em ouro 18k, prata 950, pérola e formatura na Marjouxs Joalheria. Veja modelos e fale com a equipe pelo WhatsApp."
    };
  }

  if (category.slug === "braceletes") {
    return {
      title: "Braceletes | Marjouxs Joalheria",
      description: "Conheça braceletes em Ouro 18k e Prata 950 na Marjouxs Joalheria. Consulte modelos e disponibilidade pelo WhatsApp."
    };
  }

  if (category.slug === "pingentes") {
    return {
      title: "Pingentes | Marjouxs Joalheria",
      description: "Conheça pingentes em Ouro 18k e Prata 950 na Marjouxs Joalheria. Consulte modelos e disponibilidade pelo WhatsApp."
    };
  }

  if (category.slug === "relogios") {
    return {
      title: "Relógios | Marjouxs Joalheria",
      description: "Relógios e atendimento de relojoaria na Marjouxs Joalheria em Arujá. Consulte disponibilidade e serviços pelo WhatsApp."
    };
  }

  return {
    title: `${category.name} | Marjouxs Joalheria`,
    description: `${category.description} Conheça a seleção da Marjouxs e fale com nossa equipe pelo WhatsApp.`
  };
}

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
    if (product.category === "Anéis") {
      return matchesRingMaterial(product, "ouro-18k");
    }

    return hasGold18k(product);
  }

  if (selectedFilter === "prata-950") {
    if (product.category === "Anéis") {
      return matchesRingMaterial(product, "prata-950");
    }

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

  if (selectedFilter === "perola") {
    return text.includes("perola") || subcategory.includes("perola");
  }

  if (selectedFilter === "infantil") {
    return text.includes("infantil") || subcategory.includes("infantil");
  }

  return subcategory === selectedFilter;
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  if (params.slug === "servicos") {
    return {
      title: "Serviços | Marjouxs",
      description: "Serviços de joalheria e relojoaria da Marjouxs em Arujá."
    };
  }

  const category = getCategoryBySlug(params.slug);

  if (!category) {
    return {
      title: "Categoria | Marjouxs"
    };
  }

  const seo = getCategorySeo(category);
  const url = `https://marjouxsjoias.com.br/categorias/${category.slug}`;

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url,
      siteName: "Marjouxs",
      locale: "pt_BR",
      type: "website"
    }
  };
}

export default function CategoryPage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: { subcategoria?: string; ordem?: string };
}) {
  if (params.slug === "servicos") {
    redirect("/servicos");
  }

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
  const buildCategoryHref = (subcategory?: string, href?: string) => {
    if (href) {
      return href;
    }

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
      <CategoryViewTracker categoryName={category.name} />
      <Reveal>
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{category.name}</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">{category.name} Marjouxs</h1>
          <p className="mt-4 leading-7 text-taupe">{category.description}</p>
        </div>
      </Reveal>
      {filterOptions.length > 0 && (
        <Reveal delay={80} distance={14}>
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
                  href={buildCategoryHref(filter.slug, filter.href)}
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
        </Reveal>
      )}
      <Reveal delay={120} distance={12}>
        <div className="mb-5 flex justify-end">
          <SortSelect value={sortOrder} />
        </div>
      </Reveal>
      <ProductGrid
        products={sortedProducts}
        emptyMessage="Nenhum produto com imagem cadastrado nesta categoria."
        itemListName={category.name}
        source="category_page"
      />
    </section>
  );
}
