import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductFilters } from "@/components/product-filters";
import { Reveal } from "@/components/reveal";
import { getPublicProducts } from "@/lib/catalog";
import { discoverCatalog, hasDiscoveryParams, type CatalogParams } from "@/lib/catalog/discovery";
import { absoluteUrl, DEFAULT_SOCIAL_IMAGE } from "@/lib/seo";

export async function generateMetadata({ searchParams: pendingSearchParams }: { searchParams?: Promise<CatalogParams> }) {
  const searchParams = await pendingSearchParams;
  const title = "Produtos | Marjouxs Joalheria";
  const description = "Explore joias, alianças, ouro 18k, prata e relógios da Marjouxs Joalheria. Use busca e filtros para encontrar a peça ideal.";
  const url = absoluteUrl("/produtos");
  const image = absoluteUrl(DEFAULT_SOCIAL_IMAGE);
  const hasNavigationalFilters = hasDiscoveryParams(searchParams);

  return {
    title,
    description,
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
      title,
      description,
      url,
      siteName: "Marjouxs",
      locale: "pt_BR",
      type: "website",
      images: [{ url: image, alt: "Joias e alianças Marjouxs" }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function ProductsPage({
  searchParams: pendingSearchParams
}: {
  searchParams?: Promise<CatalogParams>;
}) {
  const searchParams = await pendingSearchParams;
  const discovery = discoverCatalog(await getPublicProducts(), searchParams);
  const searchTerm = discovery.query.busca;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Produtos", href: "/produtos" }
        ]}
        className="mb-6"
      />
      <Reveal>
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Catálogo</p>
          <h1 className="mt-2 break-words font-serif text-4xl font-semibold text-ink sm:text-5xl">
            {searchTerm ? `Resultados para: ${searchTerm}` : "Produtos e serviços Marjouxs"}
          </h1>
          <p className="mt-4 leading-7 text-taupe">
            {searchTerm
              ? "Refine a busca por categoria, material, preço ou ordem de preferência."
              : "Explore joias, alianças, relógios e serviços. Use os filtros para encontrar por categoria, material ou termo."}
          </p>
        </div>
      </Reveal>
      <ProductFilters discovery={discovery} pathname="/produtos" />
    </section>
  );
}
