import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryViewTracker } from "@/components/analytics-trackers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryBanner } from "@/components/category-banner";
import { ProductFilters } from "@/components/product-filters";
import { Reveal } from "@/components/reveal";
import { getCategoryBanner } from "@/lib/category-banners";
import { categoryFilters, getCategoryFilterHref } from "@/lib/category-navigation";
import { getPublicProductsByCategory } from "@/lib/catalog";
import { getCategoryMenuFacets } from "@/lib/catalog/category-menu";
import { catalogHref, discoverCatalog, hasDiscoveryParams, matchesEditorialVariant, type CatalogParams } from "@/lib/catalog/discovery";
import { getCategoryBySlug } from "@/lib/products";
import {
  absoluteUrl,
  DEFAULT_SOCIAL_IMAGE,
  getCategorySeoDescription
} from "@/lib/seo";

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

export async function generateMetadata({
  params: pendingParams,
  searchParams: pendingSearchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<CatalogParams>;
}) {
  const params = await pendingParams;
  const searchParams = await pendingSearchParams;
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
  const categoryProducts = await getPublicProductsByCategory(category.name);
  const selectedSubcategory = searchParams?.subcategoria ?? "";
  const filterOptions = categoryFilters[category.slug] ?? [];
  const selectedFilter = filterOptions.find((filter) => filter.slug === selectedSubcategory);
  const filteredProducts = selectedFilter
    ? categoryProducts.filter((product) => matchesEditorialVariant(product, selectedFilter.slug))
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
  const shouldNoIndex = hasDiscoveryParams(searchParams, selectedFilter?.slug);
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

export default async function CategoryPage({
  params: pendingParams,
  searchParams: pendingSearchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<CatalogParams>;
}) {
  const params = await pendingParams;
  const searchParams = await pendingSearchParams;
  if (params.slug === "servicos") {
    redirect("/servicos");
  }

  const category = getCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = await getPublicProductsByCategory(category.name);
  const pathname = `/categorias/${category.slug}`;
  const filterOptions = categoryFilters[category.slug] ?? [];
  const discoveryOptions = { scoped: true, editorial: filterOptions, menuFacets: getCategoryMenuFacets(category.slug) };
  const discovery = discoverCatalog(categoryProducts, searchParams, discoveryOptions);
  const selectedSubcategory = discovery.query.subcategoria;
  const bannerVariant = selectedSubcategory || discovery.query.material || "";
  const selectedBannerFilter = filterOptions.find((filter) => filter.slug === bannerVariant);
  const bannerProducts = bannerVariant
    ? discoverCatalog(categoryProducts, { subcategoria: selectedSubcategory, material: discovery.query.material },
        discoveryOptions).products
    : categoryProducts;
  const bannerProduct = bannerProducts[0] ?? categoryProducts[0];
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
    { name: category.name, href: pathname },
    ...(selectedSubcategory
      ? [{
          name: discovery.options.subcategories[""]?.find(({ value }) => value === selectedSubcategory)?.label ??
            selectedSubcategory.replace(/-/g, " "),
          href: selectedBannerFilter
            ? getCategoryFilterHref(category.slug, selectedBannerFilter)
            : `/categorias/${category.slug}?subcategoria=${encodeURIComponent(selectedSubcategory)}`
        }]
      : [])
  ];
  const buildCategoryHref = (subcategory?: string, href?: string) =>
    href ?? catalogHref(pathname, { subcategoria: subcategory, ordem: discovery.query.ordem });

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <CategoryViewTracker categoryName={category.name} />
      <Breadcrumbs items={breadcrumbItems} className="mb-6" />
      <Reveal>
        <CategoryBanner
          banner={banner}
          page={{ categorySlug: category.slug, variantSlug: bannerVariant }}
          className="mb-8"
        />
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
        pathname={pathname}
        discovery={discovery}
        emptyMessage="Nenhum produto disponível nesta categoria no momento."
        itemListName={category.name}
        source="category_page"
      />
    </section>
  );
}
