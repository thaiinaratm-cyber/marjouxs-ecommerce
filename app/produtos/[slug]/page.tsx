import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductImage } from "@/components/product-image";
import { ProductPrice } from "@/components/product-price";
import { ProductGrid } from "@/components/product-grid";
import { hasIncludedEngravingAndBox, hasValidPrice } from "@/lib/product-pricing";
import { getProductBySlug, getProductsByCategory } from "@/lib/products";
import { buildQuoteUrl } from "@/lib/whatsapp";

function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} fill="currentColor">
      <path d="M16.01 3.2A12.66 12.66 0 0 0 5.22 22.5L3.6 28.8l6.45-1.56A12.67 12.67 0 1 0 16.01 3.2Zm0 22.98c-1.97 0-3.9-.56-5.56-1.62l-.4-.25-3.83.93.97-3.73-.26-.39a10.24 10.24 0 1 1 9.08 5.06Zm5.83-7.66c-.32-.16-1.9-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.15.32-.38.48-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.12 1.32 3.33c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.48.21 2.04.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  return {
    title: product ? `${product.name} | Marjouxs` : "Produto | Marjouxs"
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const related = getProductsByCategory(product.category).filter((item) => item.id !== product.id).slice(0, 4);
  const imageNotice =
    product.category === "Alianças"
      ? "Imagem ilustrativa. Modelos sob encomenda podem variar conforme largura, numeração, acabamento e gravação escolhidos."
      : "Imagem ilustrativa. Produto sujeito a variações de modelo, acabamento e disponibilidade.";
  const showIncludedBenefits = hasIncludedEngravingAndBox(product);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/produtos" className="inline-flex items-center gap-2 text-sm font-semibold text-taupe hover:text-gold">
        <ChevronLeft size={18} /> Voltar ao catálogo
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-champagne shadow-soft">
            <ProductImage
              src={product.images?.[0]}
              alt={product.name}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-taupe">{imageNotice}</p>
        </div>
        <div className="self-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{product.category}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg leading-8 text-taupe">{product.description}</p>

          <div className="mt-6 grid gap-3 rounded-lg border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-3">
              <span className="text-sm text-taupe">Preço</span>
              <ProductPrice product={product} />
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-3">
              <span className="text-sm text-taupe">Material</span>
              <span className="text-sm font-medium text-ink">{product.material}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-taupe">Status</span>
              <span className="text-sm font-medium text-ink">{product.stockStatus}</span>
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {product.allowWhatsappQuote && hasValidPrice(product) && (
              <a
                href={buildQuoteUrl(product)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 transition hover:bg-[#1ebe5d] hover:shadow-soft sm:flex-[1.15]"
              >
                <WhatsappIcon size={18} /> Comprar pelo WhatsApp
              </a>
            )}
            <AddToCartButton product={product} className="w-full sm:flex-1" />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="font-serif text-3xl font-semibold text-ink">Você também pode gostar</h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </div>
      )}
    </section>
  );
}
