import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, MessageCircle, Ruler, Sparkles } from "lucide-react";
import { AnalyticsAnchor, AnalyticsLink } from "@/components/analytics-link";
import { ProductViewTracker } from "@/components/analytics-trackers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCommercialInfo, ProductTrustBlock } from "@/components/product-commercial-info";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPrice } from "@/components/product-price";
import { ProductPurchaseActions } from "@/components/product-purchase-actions";
import { RelatedProducts } from "@/components/related-products";
import { createSizeGuideClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { getProductBySlug, getRelatedProducts } from "@/lib/products";
import {
  absoluteUrl,
  DEFAULT_SOCIAL_IMAGE,
  getProductBreadcrumbs,
  getProductSchema,
  getProductSeoDescription,
  serializeJsonLd
} from "@/lib/seo";
import { buildQuoteUrl } from "@/lib/whatsapp";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    return {
      title: "Produto | Marjouxs",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const description = getProductSeoDescription(product);
  const url = absoluteUrl(`/produtos/${product.slug}`);
  const image = absoluteUrl(product.images[0] ?? DEFAULT_SOCIAL_IMAGE);

  return {
    title: `${product.name} | Marjouxs Joalheria`,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${product.name} | Marjouxs Joalheria`,
      description,
      url,
      siteName: "Marjouxs",
      locale: "pt_BR",
      type: "website",
      images: [
        {
          url: image,
          alt: product.name
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | Marjouxs Joalheria`,
      description,
      images: [image]
    }
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const related = getRelatedProducts(product, 4);
  const isAlliance = product.category === "Alianças";
  const imageNotice = isAlliance
    ? "Imagem ilustrativa. Modelos sob encomenda podem variar conforme largura, numeração, acabamento e gravação escolhidos."
    : "Imagem ilustrativa. Produto sujeito a variações de modelo, acabamento e disponibilidade.";
  const showSizeGuideLink = isAlliance || product.category === "Anéis";
  const whatsappUrl = buildQuoteUrl(product);
  const productSchema = getProductSchema(product);
  const breadcrumbItems = getProductBreadcrumbs(product);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-12">
      <ProductViewTracker product={product} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }}
      />
      <Breadcrumbs items={breadcrumbItems} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-start">
        <div>
          <ProductGallery images={product.images} productName={product.name} />
          <p className="mt-3 text-xs leading-5 text-taupe">{imageNotice}</p>
        </div>

        <div className="lg:sticky lg:top-24">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{product.category}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">{product.name}</h1>
          <div className="mt-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-taupe">Preço</p>
            <div className="mt-2">
              <ProductPrice product={product} />
            </div>
          </div>

          <ProductCommercialInfo product={product} />

          <ProductPurchaseActions product={product} whatsappUrl={whatsappUrl} />

          <ProductTrustBlock product={product} />
        </div>
      </div>

      {isAlliance ? (
        <section className="mt-12 rounded-lg border border-gold/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Numeração</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">Não sabe seu tamanho?</h2>
              <p className="mt-3 text-sm leading-6 text-taupe">
                Veja nosso Guia de Tamanhos ou fale com a equipe antes da fabricação.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[34rem]">
              <AnalyticsAnchor
                href={whatsappUrl}
                analyticsEvents={createWhatsappClickEvent("product_page", product)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/10 bg-pearl px-5 py-3 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold"
              >
                <MessageCircle size={18} /> Consultar numeração pelo WhatsApp
              </AnalyticsAnchor>
              <AnalyticsLink
                href="/guia-de-tamanhos"
                analyticsEvents={createSizeGuideClickEvent("product_page", product)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold"
              >
                <Ruler size={18} /> Veja nosso Guia de Tamanhos
              </AnalyticsLink>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-12 rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Descrição</p>
        <div className="mt-4 max-w-4xl space-y-4 leading-7 text-taupe">
          {product.description.split("\n").filter(Boolean).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      {showSizeGuideLink && !isAlliance ? (
        <section className="mt-5 rounded-lg border border-black/10 bg-pearl p-5 shadow-sm sm:p-6">
          <p className="font-serif text-2xl font-semibold text-ink">Não sabe seu tamanho?</p>
          <AnalyticsLink href="/guia-de-tamanhos" analyticsEvents={createSizeGuideClickEvent("product_page", product)} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-gold">
            <Ruler size={18} /> Veja nosso Guia de Tamanhos
          </AnalyticsLink>
        </section>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-gold">
            <Sparkles size={17} /> Cuidados
          </p>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-taupe">
            <li>Evite contato com produtos químicos, perfumes e cosméticos.</li>
            <li>Guarde a peça separadamente para preservar acabamento e brilho.</li>
            <li>Realize a limpeza de acordo com o material e orientação da equipe.</li>
          </ul>
          <Link href="/cuidados-com-joias" className="mt-4 inline-flex text-sm font-semibold text-ink hover:text-gold">
            Ver cuidados com joias
          </Link>
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-gold">
            <Award size={17} /> Garantia Marjouxs
          </p>
          <p className="mt-4 text-sm leading-6 text-taupe">Consulte as condições da garantia Marjouxs.</p>
          <Link href="/termo-de-garantia" className="mt-4 inline-flex text-sm font-semibold text-ink hover:text-gold">
            Termo de garantia
          </Link>
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-gold">
            <MessageCircle size={17} /> Trocas e atendimento
          </p>
          <p className="mt-4 text-sm leading-6 text-taupe">Precisa de ajuda com troca, ajuste ou atendimento? Fale com nossa equipe.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <AnalyticsAnchor href={whatsappUrl} analyticsEvents={createWhatsappClickEvent("product_page", product)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-ink hover:text-gold">
              Falar pelo WhatsApp
            </AnalyticsAnchor>
            <Link href="/trocas-e-devolucoes" className="text-sm font-semibold text-ink hover:text-gold">
              Trocas e devoluções
            </Link>
          </div>
        </section>
      </div>

      <RelatedProducts products={related} />

    </section>
  );
}
