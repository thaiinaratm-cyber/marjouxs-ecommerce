import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryViewTracker } from "@/components/analytics-trackers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryBanner } from "@/components/category-banner";
import { ProductFilters } from "@/components/product-filters";
import { Reveal } from "@/components/reveal";
import { getCategoryBanner } from "@/lib/category-banners";
import { categoryFilters, getCategoryFilterHref } from "@/lib/category-navigation";
import { toProductFilterValue } from "@/lib/product-discovery";
import { normalizeSortOrder } from "@/lib/product-sorting";
import { getCategoryBySlug, getProductsByCategory } from "@/lib/products";
import { matchesRingMaterial } from "@/lib/ring-filters";
import {
  absoluteUrl,
  DEFAULT_SOCIAL_IMAGE,
  getCategorySeoDescription
} from "@/lib/seo";
import type { Product } from "@/types/product";

type CategorySearchParams = {
  subcategoria?: string;
  busca?: string;
  material?: string;
  preco?: string;
  ordem?: string;
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

export function generateMetadata({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: CategorySearchParams;
}) {
  if (params.slug === "servicos") {
    return {
      title: "Serviços | Marjouxs",
      description: "Serviços de joalheria e relojoaria da Marjouxs em Arujá.",
      alternates: {
        canonical: absoluteUrl("/servicos")
      }
    };
  }

  const category = getCategoryBySlug(params.slug);

  if (!category) {
    return {
      title: "Categoria | Marjouxs",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const baseSeo = getCategorySeo(category);
  const categoryProducts = getProductsByCategory(category.name);
  const selectedSubcategory = searchParams?.subcategoria ?? "";
  const filterOptions = categoryFilters[category.slug] ?? [];
  const selectedFilter = filterOptions.find((filter) => filter.slug === selectedSubcategory);
  const filteredProducts = selectedFilter
    ? categoryProducts.filter((product) => matchesProductFilter(product, selectedFilter.slug))
    : categoryProducts;
  const bannerProduct = filteredProducts[0] ?? categoryProducts[0];
  const banner = getCategoryBanner({
    categorySlug: category.slug,
    variantSlug: selectedFilter?.slug,
    eyebrow: category.name,
    fallbackTitle: selectedFilter ? `${category.name}: ${selectedFilter.label}` : `${category.name} Marjouxs`,
    fallbackSubtitle: category.description,
    image: bannerProduct?.images[0],
    imageAlt: bannerProduct?.name
  });
  const canonicalPath = selectedFilter
    ? getCategoryFilterHref(category.slug, selectedFilter)
    : `/categorias/${category.slug}`;
  const url = absoluteUrl(canonicalPath);
  const hasNavigationalFilters = Boolean(
    searchParams?.busca || searchParams?.material || searchParams?.preco || searchParams?.ordem
  );
  const shouldNoIndex = hasNavigationalFilters || Boolean(selectedSubcategory && !selectedFilter);
  const title = selectedFilter ? `${banner.title} | Marjouxs Joalheria` : baseSeo.title;
  const description = selectedFilter
    ? getCategorySeoDescription(banner.subtitle, filteredProducts)
    : baseSeo.description;
  const image = absoluteUrl(banner.image ?? DEFAULT_SOCIAL_IMAGE);

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    ...(shouldNoIndex
      ? {
          robots: {
            index: false,
            follow: true
          }
        }
      : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: "Marjouxs",
      locale: "pt_BR",
      type: "website",
      images: [{ url: image, alt: banner.imageAlt ?? banner.title }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default function CategoryPage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: CategorySearchParams;
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
  const bannerVariant = selectedSubcategory || searchParams?.material || "";
  const selectedBannerFilter = filterOptions.find((filter) => filter.slug === bannerVariant);
  const filteredProducts = selectedSubcategory
    ? categoryProducts.filter((product) => matchesProductFilter(product, selectedSubcategory))
    : categoryProducts;
  const bannerProducts = searchParams?.material
    ? filteredProducts.filter((product) => toProductFilterValue(product.material) === searchParams.material)
    : filteredProducts;
  const bannerProduct = bannerProducts[0] ?? filteredProducts[0] ?? categoryProducts[0];
  const banner = getCategoryBanner({
    categorySlug: category.slug,
    variantSlug: bannerVariant,
    eyebrow: category.name,
    fallbackTitle: selectedBannerFilter ? `${category.name}: ${selectedBannerFilter.label}` : `${category.name} Marjouxs`,
    fallbackSubtitle: category.description,
    image: bannerProduct?.images[0],
    imageAlt: bannerProduct?.name
  });
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: category.name, href: `/categorias/${category.slug}` },
    ...(selectedSubcategory
      ? [{
          name: selectedBannerFilter?.label ?? selectedSubcategory.replace(/-/g, " "),
          href: selectedBannerFilter
            ? getCategoryFilterHref(category.slug, selectedBannerFilter)
            : `/categorias/${category.slug}?subcategoria=${encodeURIComponent(selectedSubcategory)}`
        }]
      : [])
  ];
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
      <Breadcrumbs items={breadcrumbItems} className="mb-6" />
      <Reveal>
        <CategoryBanner banner={banner} className="mb-8" />
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
      <ProductFilters
        initialQuery={searchParams?.busca}
        initialMaterial={searchParams?.material}
        initialPriceRange={searchParams?.preco}
        initialOrder={sortOrder}
        products={filteredProducts}
        showCategoryFilter={false}
        emptyMessage="Nenhum produto com imagem cadastrado nesta categoria."
        itemListName={category.name}
        source="category_page"
      />
    </section>
  );
}
