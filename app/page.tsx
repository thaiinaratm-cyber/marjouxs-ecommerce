import Link from "next/link";
import { BadgeCheck, CreditCard, Gem, Hammer, HeartHandshake, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { categories } from "@/data/categories";
import { normalizeText } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import { getHomeFeaturedProducts, getVisibleProducts } from "@/lib/products";
import { FaqSection } from "@/components/faq-section";
import { HelpCard } from "@/components/help-card";
import { HomeHeroSlider } from "@/components/home-hero-slider";
import { ProductImage } from "@/components/product-image";
import { ProductGrid } from "@/components/product-grid";
import { ProductPrice } from "@/components/product-price";
import type { Product } from "@/types/product";

function getProductText(product: Product) {
  return normalizeText([product.name, product.category, product.subcategory, product.material].join(" "));
}

function pickBestSeller(
  products: Product[],
  selectedIds: Set<string>,
  predicate: (product: Product) => boolean
) {
  const product = products.find((item) => !selectedIds.has(item.id) && predicate(item));

  if (product) {
    selectedIds.add(product.id);
  }

  return product;
}

function getBestSellerProducts() {
  const products = getVisibleProducts().filter(
    (product) => product.stockStatus === "Disponível" && hasValidPrice(product)
  );
  const selectedIds = new Set<string>();
  const selected = [
    pickBestSeller(
      products,
      selectedIds,
      (product) => product.category === "Alianças" && getProductText(product).includes("ouro 18k")
    ),
    pickBestSeller(
      products,
      selectedIds,
      (product) => product.category === "Alianças" && getProductText(product).includes("prata 950")
    ),
    pickBestSeller(products, selectedIds, (product) => getProductText(product).includes("solitario")),
    pickBestSeller(products, selectedIds, (product) => product.category === "Alianças")
  ].filter(Boolean) as Product[];

  if (selected.length >= 4) {
    return selected.slice(0, 4);
  }

  return [
    ...selected,
    ...products.filter((product) => !selectedIds.has(product.id))
  ].slice(0, 4);
}

function BestSellerCard({ product }: { product: Product }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <Link href={`/produtos/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-champagne">
          <ProductImage
            src={product.images?.[0]}
            alt={product.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink">
            {product.stockStatus}
          </span>
        </div>
      </Link>
      <div className="grid gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{product.category}</p>
          <Link href={`/produtos/${product.slug}`} className="mt-1 block font-serif text-xl font-semibold text-ink">
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-taupe">{product.material}</p>
        </div>
        <ProductPrice product={product} compact />
        <Link
          href={`/produtos/${product.slug}`}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold"
        >
          Comprar
        </Link>
      </div>
    </article>
  );
}

export default function HomePage() {
  const featuredProducts = getHomeFeaturedProducts(5);
  const bestSellerProducts = getBestSellerProducts();
  const featureItems = [
    { icon: HeartHandshake, label: "Atendimento personalizado" },
    { icon: Hammer, label: "Produção própria" },
    { icon: PenLine, label: "Gravação inclusa" },
    { icon: CreditCard, label: "Pagamento seguro" }
  ];

  return (
    <>
      <HomeHeroSlider />

      <section className="border-b border-black/10 bg-pearl">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {featureItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-ink">
              <item.icon className="shrink-0 text-gold" size={18} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:gap-4 sm:px-6 sm:py-8 lg:grid-cols-3 lg:px-8">
        {[
          { icon: Gem, title: "Curadoria premium", text: "Peças selecionadas para presentear e celebrar com sofisticação." },
          { icon: ShieldCheck, title: "Atendimento confiável", text: "Pedido finalizado pelo WhatsApp com confirmação da equipe." },
          { icon: BadgeCheck, title: "Serviços técnicos", text: "Ajustes, polimento, banho, gravação e manutenção de relógios." }
        ].map((item) => (
          <div key={item.title} className="flex gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
            <item.icon className="mt-1 shrink-0 text-gold" size={24} />
            <div>
              <h2 className="font-serif text-xl font-semibold text-ink">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-taupe">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Categorias</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Escolha por ocasião</h2>
          </div>
          <Link href="/categorias" className="hidden text-sm font-semibold text-ink hover:text-gold sm:inline">
            Ver todas
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              href={`/categorias/${category.slug}`}
              key={category.slug}
              className="rounded-lg border border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-gold hover:shadow-soft"
            >
              <Sparkles className="text-gold" size={22} />
              <h3 className="mt-4 font-serif text-2xl font-semibold text-ink">{category.name}</h3>
              <p className="mt-2 text-sm leading-6 text-taupe">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Destaques</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Peças e serviços em evidência</h2>
        </div>
        <ProductGrid products={featuredProducts} />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Mais vendidos</h2>
            <p className="mt-2 text-sm leading-6 text-taupe sm:text-base">
              Modelos escolhidos para celebrar momentos especiais.
            </p>
          </div>
          <Link href="/produtos" className="hidden shrink-0 text-sm font-semibold text-ink hover:text-gold sm:inline">
            Ver todos os produtos
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {bestSellerProducts.map((product) => (
            <BestSellerCard key={product.id} product={product} />
          ))}
        </div>
        <Link
          href="/produtos"
          className="mt-6 inline-flex text-sm font-semibold text-ink hover:text-gold sm:hidden"
        >
          Ver todos os produtos
        </Link>
      </section>

      <HelpCard />
      <FaqSection compact />
    </>
  );
}
