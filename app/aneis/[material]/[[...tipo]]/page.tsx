import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyticsLink } from "@/components/analytics-link";
import { CategoryViewTracker } from "@/components/analytics-trackers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryBanner } from "@/components/category-banner";
import { ProductFilters } from "@/components/product-filters";
import { Reveal } from "@/components/reveal";
import { createSizeGuideClickEvent } from "@/lib/analytics";
import { getCategoryBanner } from "@/lib/category-banners";
import { normalizeSortOrder } from "@/lib/product-sorting";
import {
  absoluteUrl,
  DEFAULT_SOCIAL_IMAGE,
  getCategorySeoDescription
} from "@/lib/seo";
import {
  getRingMaterialGroup,
  getRingProducts,
  getRingSubcategory,
  isRingMaterialSlug,
  ringMaterialGroups,
  type RingSubcategorySlug
} from "@/lib/ring-filters";

type RingSearchParams = {
  busca?: string;
  material?: string;
  preco?: string;
  ordem?: string;
};

export function generateStaticParams() {
  return ringMaterialGroups.flatMap((group) => [
    { material: group.slug },
    ...group.subcategories.map((subcategory) => ({
      material: group.slug,
      tipo: [subcategory.slug]
    }))
  ]);
}

export function generateMetadata({
  params,
  searchParams
}: {
  params: { material: string; tipo?: string[] };
  searchParams?: RingSearchParams;
}) {
  if (!isRingMaterialSlug(params.material)) {
    return {
      title: "Anéis | Marjouxs Joalheria",
      description: "Anéis em ouro 18k e prata 950 na Marjouxs Joalheria.",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const group = getRingMaterialGroup(params.material);
  const subcategory = getRingSubcategory(params.material, params.tipo?.[0]);
  const title = subcategory ? `Anéis ${group?.label} ${subcategory.label}` : `Anéis ${group?.label}`;
  const description = subcategory
    ? `Modelos ${subcategory.label.toLowerCase()} em ${group?.label}, selecionados para momentos especiais.`
    : `Todos os modelos de anéis em ${group?.label}, reunidos em uma seleção elegante da Marjouxs.`;
  const products = getRingProducts(params.material, subcategory?.slug);
  const bannerProduct = products[0] ?? getRingProducts(params.material)[0];
  const seoDescription = getCategorySeoDescription(description, products);
  const url = absoluteUrl(
    subcategory
      ? `/aneis/${params.material}/${subcategory.slug}`
      : `/aneis/${params.material}`
  );
  const image = absoluteUrl(bannerProduct?.images[0] ?? DEFAULT_SOCIAL_IMAGE);
  const hasNavigationalFilters = Boolean(
    searchParams?.busca || searchParams?.material || searchParams?.preco || searchParams?.ordem
  );

  return {
    title: `${title} | Marjouxs Joalheria`,
    description: seoDescription,
    alternates: {
      canonical: url
    },
    ...(hasNavigationalFilters
      ? {
          robots: {
            index: false,
            follow: true
          }
        }
      : {}),
    openGraph: {
      title: `${title} | Marjouxs Joalheria`,
      description: seoDescription,
      url,
      siteName: "Marjouxs",
      locale: "pt_BR",
      type: "website",
      images: [{ url: image, alt: bannerProduct?.name ?? title }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Marjouxs Joalheria`,
      description: seoDescription,
      images: [image]
    }
  };
}

export default function RingCategoryPage({
  params,
  searchParams
}: {
  params: { material: string; tipo?: string[] };
  searchParams?: RingSearchParams;
}) {
  const materialSlug = params.material;
  const subcategoryPath = params.tipo ?? [];

  if (!isRingMaterialSlug(materialSlug)) {
    notFound();
  }

  const group = getRingMaterialGroup(materialSlug);
  const subcategorySlug = subcategoryPath[0] as RingSubcategorySlug | undefined;
  const subcategory = subcategorySlug ? getRingSubcategory(materialSlug, subcategorySlug) : undefined;

  if (!group || subcategoryPath.length > 1 || (subcategorySlug && !subcategory)) {
    notFound();
  }

  const sortOrder = normalizeSortOrder(searchParams?.ordem);
  const products = getRingProducts(materialSlug, subcategory?.slug);
  const bannerProduct = products[0] ?? getRingProducts(materialSlug)[0];
  const title = subcategory ? `Anéis ${group.label} ${subcategory.label}` : `Anéis ${group.label}`;
  const subtitle = subcategory
    ? `Modelos ${subcategory.label.toLowerCase()} em ${group.label}, selecionados para momentos especiais.`
    : `Todos os modelos de anéis em ${group.label}, reunidos em uma seleção elegante da Marjouxs.`;
  const banner = getCategoryBanner({
    categorySlug: "aneis",
    variantSlug: subcategory?.slug ?? group.slug,
    eyebrow: "Anéis",
    fallbackTitle: title,
    fallbackSubtitle: subtitle,
    image: bannerProduct?.images[0],
    imageAlt: bannerProduct?.name
  });
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Anéis", href: "/categorias/aneis" },
    { name: group.label, href: `/aneis/${group.slug}` },
    ...(subcategory
      ? [{ name: subcategory.label, href: `/aneis/${group.slug}/${subcategory.slug}` }]
      : [])
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <CategoryViewTracker categoryName={title} />
      <Reveal distance={12}>
        <Breadcrumbs items={breadcrumbItems} className="mb-6" />
      </Reveal>

      <Reveal delay={60} distance={16}>
        <CategoryBanner banner={banner} />
        <AnalyticsLink href="/guia-de-tamanhos" analyticsEvents={createSizeGuideClickEvent("category_page")} className="mb-8 mt-4 inline-flex text-sm font-semibold text-ink transition hover:text-gold">
          Não sabe seu tamanho? Veja nosso Guia de Tamanhos
        </AnalyticsLink>
      </Reveal>

      <Reveal delay={100} distance={14}>
        <div className="mb-8 flex flex-wrap gap-2">
          {ringMaterialGroups.map((materialGroup) => (
            <Link
              key={materialGroup.slug}
              href={`/aneis/${materialGroup.slug}`}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                materialGroup.slug === group.slug && !subcategory
                  ? "border-ink bg-ink text-white"
                  : "border-black/10 bg-white text-ink hover:border-gold hover:text-gold"
              }`}
            >
              {materialGroup.label}
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal delay={140} distance={14}>
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={`/aneis/${group.slug}`}
            className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
              subcategory
                ? "border-black/10 bg-white text-ink hover:border-gold hover:text-gold"
                : "border-ink bg-ink text-white"
            }`}
          >
            Todos em {group.label}
          </Link>
          {group.subcategories.map((item) => (
            <Link
              key={item.slug}
              href={`/aneis/${group.slug}/${item.slug}`}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                subcategory?.slug === item.slug
                  ? "border-ink bg-ink text-white"
                  : "border-black/10 bg-white text-ink hover:border-gold hover:text-gold"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </Reveal>

      <ProductFilters
        initialQuery={searchParams?.busca}
        initialMaterial={searchParams?.material}
        initialPriceRange={searchParams?.preco}
        initialOrder={sortOrder}
        products={products}
        showCategoryFilter={false}
        emptyMessage="Nenhum anel encontrado nesta seleção."
        itemListName={title}
        source="category_page"
      />
    </section>
  );
}
