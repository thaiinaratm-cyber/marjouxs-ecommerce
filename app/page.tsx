import Link from "next/link";
import { ArrowRight, CreditCard, Gem, HeartHandshake, Instagram, MapPin, MessageCircle, Navigation, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { categories } from "@/data/categories";
import { WHATSAPP_NUMBER } from "@/lib/constants";
import { createCategoryClickEvent, createContactClickEvent, createDirectionsClickEvent, createSizeGuideClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { normalizeText } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import { getHomeFeaturedProducts, getVisibleProducts } from "@/lib/products";
import { AnalyticsLink } from "@/components/analytics-link";
import { FaqSection } from "@/components/faq-section";
import { HelpCard } from "@/components/help-card";
import { HomeHeroSlider } from "@/components/home-hero-slider";
import { ProductGrid } from "@/components/product-grid";
import { Reveal } from "@/components/reveal";
import type { Product } from "@/types/product";

export const metadata = {
  title: "Marjouxs Joalheria | Joias, Alianças e Relógios em Arujá",
  description: "Joias, alianças, ouro 18k, prata, relógios e serviços de joalheria em Arujá. Conheça a Marjouxs e fale conosco pelo WhatsApp.",
  alternates: {
    canonical: "https://marjouxsjoias.com.br"
  },
  openGraph: {
    title: "Marjouxs Joalheria | Joias, Alianças e Relógios em Arujá",
    description: "Joias, alianças, ouro 18k, prata, relógios e serviços de joalheria em Arujá. Conheça a Marjouxs e fale conosco pelo WhatsApp.",
    url: "https://marjouxsjoias.com.br",
    siteName: "Marjouxs",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "https://marjouxsjoias.com.br/images/banner-aliancas-marjouxs.png",
        alt: "Marjouxs Joalheria"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Marjouxs Joalheria | Joias, Alianças e Relógios em Arujá",
    description: "Joias, alianças, ouro 18k, prata, relógios e serviços de joalheria em Arujá.",
    images: ["https://marjouxsjoias.com.br/images/banner-aliancas-marjouxs.png"]
  }
};

function getProductText(product: Product) {
  return normalizeText([product.name, product.category, product.subcategory, product.material, product.description].join(" "));
}

function getCatalogProducts() {
  return getVisibleProducts().filter((product) => product.category !== "Serviços");
}

function pickProducts(products: Product[], predicate: (product: Product) => boolean, limit = 4) {
  return products.filter(predicate).slice(0, limit);
}

const storeVisit = {
  name: "Marjouxs Joalheria",
  addressLines: ["Avenida João Manoel, 600", "Prédio JM 600 - Térreo", "Arujá - SP"],
  instagramUrl: "https://www.instagram.com/marjouxs/",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Avenida%20Jo%C3%A3o%20Manoel%20600%20Pr%C3%A9dio%20JM%20600%20Aruj%C3%A1%20SP"
};

const storePhotos: { src: string; alt: string }[] = [
  { src: "/images/loja-marjouxs.jpg", alt: "Loja física Marjouxs Joalheria em Arujá" }
];

const categoryHighlights = [
  ...categories.slice(0, 6).map((category) => ({
    name: category.name,
    description: category.description,
    href: `/categorias/${category.slug}`,
    icon: Sparkles
  })),
  {
    name: "Ouro 18k",
    description: "Joias e alianças em ouro para momentos especiais.",
    href: "/produtos?busca=Ouro%2018k",
    icon: Gem
  },
  {
    name: "Prata",
    description: "Modelos em prata para presentear e usar todos os dias.",
    href: "/produtos?busca=Prata",
    icon: Sparkles
  }
];

const trustItems = [
  { icon: MapPin, title: "Loja física em Arujá", text: "Atendimento próximo para orientar sua escolha com segurança." },
  { icon: ShieldCheck, title: "Certificado de garantia", text: "Condições consultadas conforme cada peça e política da loja." },
  { icon: HeartHandshake, title: "Atendimento pelo WhatsApp", text: "Compra conduzida diretamente com a equipe da Marjouxs." },
  { icon: CreditCard, title: "Parcelamento facilitado", text: "Condições apresentadas no site conforme material e produto." }
];

function StoreVisitSection() {
  const [mainPhoto, secondaryPhoto] = storePhotos;
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de falar com a Marjouxs.")}`;

  return (
    <Reveal>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1.27fr)_minmax(0,1fr)]">
          <div className="order-1 lg:order-2 lg:pl-4 lg:pt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Loja física</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Visite a Marjouxs em Arujá</h2>
            <p className="mt-4 max-w-2xl leading-7 text-taupe">
              Conheça nossa loja física e conte com atendimento personalizado para escolher sua joia com mais segurança.
            </p>
            <p className="mt-3 text-sm font-medium text-ink">Joias, alianças e atendimento especializado em Arujá.</p>
          </div>

          <div className="order-2 mt-6 overflow-hidden rounded-lg lg:order-1 lg:row-span-2 lg:mt-0 lg:pr-6">
            <div className="relative min-h-[19rem] overflow-hidden rounded-lg bg-champagne sm:min-h-[25rem] lg:h-full lg:min-h-[31rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mainPhoto.src}
                alt={mainPhoto.alt}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-center transition duration-300 ease-out lg:hover:scale-[1.02]"
              />
              {secondaryPhoto ? (
                <div className="absolute bottom-4 right-4 hidden h-28 w-36 overflow-hidden rounded-md border border-white/70 bg-white shadow-soft sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={secondaryPhoto.src} alt={secondaryPhoto.alt} loading="lazy" className="h-full w-full object-cover object-center" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="order-3 mt-6 lg:pl-4 lg:pb-6">
            <div className="rounded-lg border border-black/10 bg-pearl p-4">
              <p className="flex items-center gap-2 font-serif text-xl font-semibold text-ink">
                <MapPin className="text-gold" size={20} /> {storeVisit.name}
              </p>
              <address className="mt-3 not-italic text-sm leading-6 text-taupe">
                {storeVisit.addressLines.map((line) => (
                  <span key={line} className="block">{line}</span>
                ))}
              </address>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <AnalyticsLink
                href={storeVisit.mapsUrl}
                target="_blank"
                rel="noreferrer"
                analyticsEvents={createDirectionsClickEvent("home_store")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold uppercase text-white transition hover:bg-gold"
              >
                <Navigation size={18} /> Como chegar
              </AnalyticsLink>
              <AnalyticsLink
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                analyticsEvents={createWhatsappClickEvent("store_section")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold uppercase text-white transition hover:bg-[#1ebe5d]"
              >
                <MessageCircle size={18} /> Falar no WhatsApp
              </AnalyticsLink>
            </div>

            <AnalyticsLink
              href={storeVisit.instagramUrl}
              target="_blank"
              rel="noreferrer"
              analyticsEvents={createContactClickEvent("instagram", "home_store")}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-gold"
            >
              <Instagram size={17} /> Ver Instagram
            </AnalyticsLink>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function ProductSection({
  eyebrow,
  title,
  text,
  href,
  linkLabel,
  products
}: {
  eyebrow?: string;
  title: string;
  text: string;
  href: string;
  linkLabel: string;
  products: Product[];
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <Reveal>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Reveal distance={16}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{eyebrow}</p> : null}
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-taupe sm:text-base">{text}</p>
            </div>
            <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-ink transition hover:text-gold">
              {linkLabel} <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
        <ProductGrid products={products} itemListName={title} source="home" />
      </section>
    </Reveal>
  );
}

export default function HomePage() {
  const catalogProducts = getCatalogProducts();
  const pricedProducts = catalogProducts.filter((product) => hasValidPrice(product));
  const featuredProducts = getHomeFeaturedProducts(8).filter((product) => product.category !== "Serviços").slice(0, 4);
  const allianceProducts = pickProducts(pricedProducts, (product) => product.category === "Alianças");
  const goldProducts = pickProducts(pricedProducts, (product) => getProductText(product).includes("ouro 18k"));
  const silverProducts = pickProducts(pricedProducts, (product) => getProductText(product).includes("prata"));
  const newTestimonials: { name: string; city?: string; text: string; rating?: number }[] = [];

  return (
    <>
      <HomeHeroSlider />

      <Reveal distance={12}>
        <section className="border-b border-black/10 bg-pearl">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-4 lg:px-8">
            {[
              { icon: HeartHandshake, label: "Atendimento personalizado" },
              { icon: PenLine, label: "Gravação inclusa" },
              { icon: ShieldCheck, label: "Compra segura" },
              { icon: CreditCard, label: "Pagamento facilitado" }
            ].map((item, index) => (
              <Reveal key={item.label} delay={Math.min(index, 5) * 60} distance={10}>
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <item.icon className="shrink-0 text-gold" size={18} />
                  <span>{item.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <Reveal distance={16}>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Categorias</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Encontre sua joia ideal</h2>
                <p className="mt-2 text-sm leading-6 text-taupe sm:text-base">
                  Navegue pelas principais linhas da Marjouxs e chegue aos modelos certos com poucos cliques.
                </p>
              </div>
              <Link href="/categorias" className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-ink transition hover:text-gold">
                Ver categorias <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categoryHighlights.map((category, index) => (
              <Reveal key={category.name} delay={Math.min(index, 5) * 60} distance={16} className="h-full">
                <AnalyticsLink
                  href={category.href}
                  analyticsEvents={createCategoryClickEvent(category.name, "home", category.href)}
                  className="group block h-full rounded-lg border border-black/10 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold hover:shadow-soft sm:p-5"
                >
                  <category.icon className="text-gold transition duration-300 group-hover:scale-[1.03]" size={21} />
                  <h3 className="mt-3 font-serif text-xl font-semibold leading-tight text-ink transition group-hover:text-gold sm:text-2xl">{category.name}</h3>
                  <p className="mt-2 hidden text-sm leading-6 text-taupe sm:block">{category.description}</p>
                </AnalyticsLink>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      <ProductSection
        eyebrow="Destaques"
        title="Destaques da Marjouxs"
        text="Peças selecionadas do catálogo para presentear, celebrar e escolher com atendimento personalizado."
        href="/produtos?ordem=destaques"
        linkLabel="Ver destaques"
        products={featuredProducts}
      />

      <ProductSection
        eyebrow="Alianças"
        title="Alianças para momentos inesquecíveis"
        text="Modelos em ouro, prata e sob medida para marcar histórias importantes."
        href="/categorias/aliancas"
        linkLabel="Ver todas as alianças"
        products={allianceProducts}
      />

      <Reveal>
        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-black/10 bg-pearl p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <p className="font-serif text-2xl font-semibold text-ink">Não sabe seu tamanho?</p>
              <p className="mt-1 text-sm leading-6 text-taupe">Veja nosso Guia de Tamanhos antes de escolher alianças e anéis.</p>
            </div>
            <AnalyticsLink href="/guia-de-tamanhos" analyticsEvents={createSizeGuideClickEvent("home")} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold sm:mt-0">
              Veja nosso Guia de Tamanhos
            </AnalyticsLink>
          </div>
        </section>
      </Reveal>

      <ProductSection
        eyebrow="Ouro 18k"
        title="Ouro 18k"
        text="Joias para acompanhar momentos especiais com brilho, presença e acabamento elegante."
        href="/produtos?busca=Ouro%2018k"
        linkLabel="Ver todas"
        products={goldProducts}
      />

      <ProductSection
        eyebrow="Prata"
        title="Prata"
        text="Peças em prata para uso diário, presentes especiais e combinações delicadas."
        href="/produtos?busca=Prata"
        linkLabel="Ver todas"
        products={silverProducts}
      />

      <Reveal>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <Reveal distance={16}>
            <div className="mb-6 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Confiança</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Benefícios Marjouxs</h2>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item, index) => (
              <Reveal key={item.title} delay={Math.min(index, 5) * 60} distance={16} className="h-full">
                <article className="h-full rounded-lg border border-black/10 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-soft">
                  <item.icon className="text-gold" size={22} />
                  <h3 className="mt-4 font-serif text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-taupe">{item.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      {newTestimonials.length > 0 ? (
        <Reveal>
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
            <div className="mb-6 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Depoimentos</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">O que nossos clientes dizem</h2>
            </div>
          </section>
        </Reveal>
      ) : null}

      <Reveal>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="rounded-lg border border-black/10 bg-ink p-6 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Instagram</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">Acompanhe a Marjouxs</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                Veja novidades, modelos e inspirações direto no perfil oficial da loja.
              </p>
            </div>
            <Link
              href="https://www.instagram.com/marjouxs/"
              target="_blank"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink sm:mt-0"
            >
              <Instagram size={18} /> Ver Instagram
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <HelpCard />
      </Reveal>
      <Reveal>
        <FaqSection compact />
      </Reveal>
      <StoreVisitSection />
    </>
  );
}
