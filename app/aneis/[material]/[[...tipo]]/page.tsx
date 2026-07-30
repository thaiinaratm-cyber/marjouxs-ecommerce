import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { SortSelect } from "@/components/sort-select";
import { normalizeSortOrder, sortProducts } from "@/lib/product-sorting";
import {
  getRingMaterialGroup,
  getRingProducts,
  getRingSubcategory,
  isRingMaterialSlug,
  ringMaterialGroups,
  type RingSubcategorySlug
} from "@/lib/ring-filters";

export function generateStaticParams() {
  return ringMaterialGroups.flatMap((group) => [
    { material: group.slug },
    ...group.subcategories.map((subcategory) => ({
      material: group.slug,
      tipo: [subcategory.slug]
    }))
  ]);
}

export function generateMetadata({ params }: { params: { material: string; tipo?: string[] } }) {
  if (!isRingMaterialSlug(params.material)) {
    return { title: "Anéis | Marjouxs" };
  }

  const group = getRingMaterialGroup(params.material);
  const subcategory = getRingSubcategory(params.material, params.tipo?.[0]);
  const title = subcategory ? `Anéis ${group?.label} ${subcategory.label}` : `Anéis ${group?.label}`;

  return {
    title: `${title} | Marjouxs`
  };
}

export default function RingCategoryPage({
  params,
  searchParams
}: {
  params: { material: string; tipo?: string[] };
  searchParams?: { ordem?: string };
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
  const products = sortProducts(getRingProducts(materialSlug, subcategory?.slug), sortOrder);
  const title = subcategory ? `Anéis ${group.label} ${subcategory.label}` : `Anéis ${group.label}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-taupe">
        <Link href="/" className="transition hover:text-gold">Home</Link>
        <span>/</span>
        <Link href="/categorias/aneis" className="transition hover:text-gold">Anéis</Link>
        <span>/</span>
        <Link href={`/aneis/${group.slug}`} className="transition hover:text-gold">{group.label}</Link>
        {subcategory ? (
          <>
            <span>/</span>
            <span className="text-ink">{subcategory.label}</span>
          </>
        ) : null}
      </nav>

      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Anéis</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 leading-7 text-taupe">
          {subcategory
            ? `Modelos ${subcategory.label.toLowerCase()} em ${group.label}, selecionados para momentos especiais.`
            : `Todos os modelos de anéis em ${group.label}, reunidos em uma seleção elegante da Marjouxs.`}
        </p>
      </div>

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

      <div className="mb-5 flex justify-end">
        <SortSelect value={sortOrder} />
      </div>

      <ProductGrid products={products} emptyMessage="Nenhum anel encontrado nesta seleção." />
    </section>
  );
}
