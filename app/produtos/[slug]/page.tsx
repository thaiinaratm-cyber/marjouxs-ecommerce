import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductImage } from "@/components/product-image";
import { ProductPrice } from "@/components/product-price";
import { ProductGrid } from "@/components/product-grid";
import { hasValidPrice } from "@/lib/product-pricing";
import { getProductBySlug, getProductsByCategory } from "@/lib/products";
import { buildQuoteUrl } from "@/lib/whatsapp";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  return {
    title: product ? `${product.name} | Antoér Joalheria` : "Produto | Antoér Joalheria"
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <AddToCartButton product={product} />
            {product.allowWhatsappQuote && hasValidPrice(product) && (
              <a
                href={buildQuoteUrl(product)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold"
              >
                <MessageCircle size={18} /> Falar no WhatsApp
              </a>
            )}
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
