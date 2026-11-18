import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductViewTracker } from "@/components/analytics-trackers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCharacteristics } from "@/components/product-characteristics";
import { ProductTrustBlock } from "@/components/product-commercial-info";
import { ProductDescription } from "@/components/product-description";
import { ProductFaq } from "@/components/product-faq";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPrice } from "@/components/product-price";
import { ProductPurchaseActions } from "@/components/product-purchase-actions";
import { RelatedProducts } from "@/components/related-products";
import { getPublicProductBySlug, getPublicRelatedProducts } from "@/lib/catalog";
import { hasValidPrice } from "@/lib/product-pricing";
import {
  absoluteUrl,
  DEFAULT_SOCIAL_IMAGE,
  getProductBreadcrumbs,
  getProductSchema,
  getProductSeoDescription,
  serializeJsonLd
} from "@/lib/seo";
import { buildProductInquiryUrl } from "@/lib/whatsapp";

export async function generateMetadata({ params: pendingParams }: { params: Promise<{ slug: string }> }) {
  const params = await pendingParams;
  const product = await getPublicProductBySlug(params.slug);

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
  const title = product.seoTitle?.trim() || `${product.name} | Marjouxs Joalheria`;
  const url = absoluteUrl(`/produtos/${product.slug}`);
  const image = absoluteUrl(product.images[0] ?? DEFAULT_SOCIAL_IMAGE);

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Marjouxs",
      locale: "pt_BR",
      type: "website",
      images: [
        {
          url: image,
          alt: product.imageAlt?.trim() || product.name
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function ProductPage({ params: pendingParams }: { params: Promise<{ slug: string }> }) {
  const params = await pendingParams;
  const product = await getPublicProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const related = await getPublicRelatedProducts(product, 4);
  const isAlliance = product.category === "Alianças";
  const imageNotice = isAlliance
    ? "Imagem ilustrativa. Modelos sob encomenda podem variar conforme largura, numeração, acabamento e gravação escolhidos."
    : "Imagem ilustrativa. Produto sujeito a variações de modelo, acabamento e disponibilidade.";
  const hasPrice = hasValidPrice(product);
  const whatsappUrl = buildProductInquiryUrl(product, !hasPrice);
  const productSchema = getProductSchema(product);
  const breadcrumbItems = getProductBreadcrumbs(product);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <ProductViewTracker product={product} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }}
      />
      <Breadcrumbs items={breadcrumbItems} className="mb-6" />

      <div className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
        <header className="min-w-0 lg:col-start-2 lg:row-start-1">
          <p className="text-sm font-semibold text-gold">{product.category}</p>
          <h1 className="mt-2 break-words font-serif text-3xl font-semibold leading-tight text-ink sm:text-5xl">{product.name}</h1>
          {hasPrice && isAlliance ? <p className="mt-2 text-sm text-taupe">Valor referente ao par.</p> : null}
        </header>

        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ProductGallery images={product.images} productName={product.name} imageAlt={product.imageAlt} />
          <p className="mt-3 text-xs leading-5 text-taupe">{imageNotice}</p>
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          {hasPrice ? <ProductPrice product={product} /> : (
            <p className="font-serif text-2xl font-semibold text-ink">
              {product.allowWhatsappQuote ? "Preço sob consulta" : "Preço não informado"}
            </p>
          )}
          <ProductPurchaseActions key={product.id} product={product} whatsappUrl={whatsappUrl} />
          <ProductTrustBlock product={product} />
        </div>
      </div>

      <ProductCharacteristics product={product} />
      <ProductDescription description={product.description} />
      {product.category !== "Serviços" && product.stockStatus !== "Serviço" ? (
        <Link href="/cuidados-com-joias" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold">
          Cuidados com joias
        </Link>
      ) : null}
      <ProductFaq product={product} />

      <RelatedProducts products={related.products} mode={related.mode} />

    </section>
  );
}
