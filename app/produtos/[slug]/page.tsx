import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Check, ChevronLeft, MessageCircle, Ruler, ShieldCheck, Sparkles } from "lucide-react";
import { AnalyticsAnchor, AnalyticsLink } from "@/components/analytics-link";
import { ProductViewTracker } from "@/components/analytics-trackers";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPrice } from "@/components/product-price";
import { ProductGrid } from "@/components/product-grid";
import { ProductPurchaseActions } from "@/components/product-purchase-actions";
import { createSizeGuideClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { normalizeText } from "@/lib/format";
import { hasIncludedEngravingAndBox, hasValidPrice } from "@/lib/product-pricing";
import { getProductBySlug, getProductsByCategory } from "@/lib/products";
import { buildQuoteUrl } from "@/lib/whatsapp";
import type { Product } from "@/types/product";

const STORE_URL = "https://marjouxsjoias.com.br";

function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} fill="currentColor">
      <path d="M16.01 3.2A12.66 12.66 0 0 0 5.22 22.5L3.6 28.8l6.45-1.56A12.67 12.67 0 1 0 16.01 3.2Zm0 22.98c-1.97 0-3.9-.56-5.56-1.62l-.4-.25-3.83.93.97-3.73-.26-.39a10.24 10.24 0 1 1 9.08 5.06Zm5.83-7.66c-.32-.16-1.9-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.15.32-.38.48-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.12 1.32 3.33c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.48.21 2.04.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

function getAbsoluteImageUrl(product: Product) {
  const image = product.images?.[0];

  if (!image) {
    return `${STORE_URL}/produtos`;
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${STORE_URL}${image.startsWith("/") ? image : `/${image}`}`;
}

function getProductDescription(product: Product) {
  const material = product.material ? `${product.material} ` : "";
  return `${product.name} ${material}na Marjouxs Joalheria. Consulte disponibilidade, condições e atendimento pelo WhatsApp.`;
}

function getMaterialBenefit(product: Product) {
  const material = normalizeText(product.material);

  if (material.includes("ouro 18k")) {
    return "Ouro 18k / 750";
  }

  if (material.includes("prata")) {
    return product.material;
  }

  return null;
}

function getAllianceDetails(product: Product) {
  const normalizedDescription = normalizeText(product.description);
  const deadlineMatch = product.description.match(/(?:em\s+)?até\s+\d+\s+dias?/i);
  const details = [
    { label: "Material", value: product.material },
    normalizedDescription.includes("numeracao") || normalizedDescription.includes("aro") || normalizedDescription.includes("tamanho")
      ? { label: "Numeração", value: "Confirmada no atendimento" }
      : null,
    hasIncludedEngravingAndBox(product)
      ? { label: "Gravação", value: "Gravação dos nomes inclusa" }
      : normalizedDescription.includes("gravacao")
        ? { label: "Gravação", value: "Gravação disponível" }
        : null,
    deadlineMatch ? { label: "Prazo de confecção", value: deadlineMatch[0] } : null,
    normalizedDescription.includes("garantia") ? { label: "Garantia", value: "Consulte as condições da garantia Marjouxs" } : null
  ];

  return details.filter((item): item is { label: string; value: string } => Boolean(item?.value));
}

function getTrustBenefits(product: Product) {
  const materialBenefit = getMaterialBenefit(product);
  return [
    "Loja física em Arujá",
    "Certificado de garantia",
    "Atendimento pelo WhatsApp",
    "Atendimento especializado",
    "Parcelamento facilitado",
    materialBenefit
  ].filter(Boolean) as string[];
}

function getProductSchema(product: Product) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || getProductDescription(product),
    image: product.images.map((image) =>
      image.startsWith("http://") || image.startsWith("https://") ? image : `${STORE_URL}${image.startsWith("/") ? image : `/${image}`}`
    ),
    brand: {
      "@type": "Brand",
      name: "Marjouxs"
    }
  };

  if (hasValidPrice(product) && product.price) {
    schema.offers = {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "BRL",
      url: `${STORE_URL}/produtos/${product.slug}`,
      availability: product.stockStatus === "Disponível" ? "https://schema.org/InStock" : "https://schema.org/PreOrder"
    };
  }

  return schema;
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    return {
      title: "Produto | Marjouxs"
    };
  }

  const description = getProductDescription(product);
  const url = `${STORE_URL}/produtos/${product.slug}`;

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
          url: getAbsoluteImageUrl(product),
          alt: product.name
        }
      ]
    }
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const related = getProductsByCategory(product.category).filter((item) => item.id !== product.id).slice(0, 4);
  const isAlliance = product.category === "Alianças";
  const imageNotice = isAlliance
    ? "Imagem ilustrativa. Modelos sob encomenda podem variar conforme largura, numeração, acabamento e gravação escolhidos."
    : "Imagem ilustrativa. Produto sujeito a variações de modelo, acabamento e disponibilidade.";
  const showIncludedBenefits = hasIncludedEngravingAndBox(product);
  const allianceDetails = isAlliance ? getAllianceDetails(product) : [];
  const showSizeGuideLink = isAlliance || product.category === "Anéis";
  const trustBenefits = getTrustBenefits(product);
  const whatsappUrl = buildQuoteUrl(product);
  const detailItems = [
    { label: "Material", value: product.material },
    { label: "Disponibilidade", value: product.stockStatus }
  ].filter((item) => item.value);
  const productSchema = getProductSchema(product);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-12">
      <ProductViewTracker product={product} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Link href="/produtos" className="inline-flex items-center gap-2 text-sm font-semibold text-taupe hover:text-gold">
        <ChevronLeft size={18} /> Voltar ao catálogo
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-start">
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

          {showIncludedBenefits ? (
            <div className="mt-4 grid gap-2 rounded-lg border border-gold/25 bg-gold/5 p-4 text-sm text-ink">
              {["Gravação dos nomes inclusa", "Caixinha de joia inclusa"].map((benefit) => (
                <p key={benefit} className="flex items-center gap-2">
                  <Check className="shrink-0 text-gold" size={17} />
                  <span>{benefit}</span>
                </p>
              ))}
            </div>
          ) : null}

          <ProductPurchaseActions product={product} whatsappUrl={whatsappUrl} />

          <div className="mt-5 grid gap-2 rounded-lg border border-black/10 bg-pearl p-4 text-sm text-ink sm:grid-cols-2">
            {trustBenefits.map((benefit) => (
              <p key={benefit} className="flex items-center gap-2">
                <ShieldCheck className="shrink-0 text-gold" size={17} />
                <span>{benefit}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      {isAlliance ? (
        <section className="mt-12 rounded-lg border border-gold/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Sobre esta aliança</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">Detalhes para escolher com segurança</h2>
              {allianceDetails.length > 0 ? (
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  {allianceDetails.map((item) => (
                    <div key={item.label} className="rounded-md border border-black/10 bg-pearl p-4">
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">{item.label}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            <div className="grid gap-3 rounded-lg border border-black/10 bg-pearl p-4">
              <p className="font-serif text-xl font-semibold text-ink">Não sabe seu tamanho?</p>
              <p className="text-sm leading-6 text-taupe">Veja nosso Guia de Tamanhos ou fale com a equipe antes da fabricação.</p>
              <AnalyticsAnchor
                href={whatsappUrl}
                analyticsEvents={createWhatsappClickEvent("product_page", product)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold uppercase text-white transition hover:bg-[#1ebe5d]"
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

      <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Descrição</p>
          <div className="mt-4 space-y-4 leading-7 text-taupe">
            {product.description.split("\n").filter(Boolean).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Detalhes</p>
          <dl className="mt-4 grid gap-3">
            {detailItems.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 border-b border-black/10 pb-3 last:border-b-0 last:pb-0">
                <dt className="text-sm text-taupe">{item.label}</dt>
                <dd className="text-right text-sm font-medium text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

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

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="font-serif text-3xl font-semibold text-ink">Você também pode gostar</h2>
          <div className="mt-6">
            <ProductGrid products={related} itemListName="Produtos relacionados" source="related_products" />
          </div>
        </div>
      )}

      {product.allowWhatsappQuote ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-4 py-3 shadow-soft backdrop-blur lg:hidden">
          <AnalyticsAnchor
            href={whatsappUrl}
            analyticsEvents={createWhatsappClickEvent("product_page", product)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1ebe5d]"
          >
            <WhatsappIcon size={18} /> Comprar pelo WhatsApp
          </AnalyticsAnchor>
        </div>
      ) : null}
    </section>
  );
}
