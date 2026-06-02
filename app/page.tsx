import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Gem, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { categories } from "@/data/categories";
import { WHATSAPP_NUMBER } from "@/lib/constants";
import { getHomeFeaturedProducts } from "@/lib/products";
import { FaqSection } from "@/components/faq-section";
import { HelpCard } from "@/components/help-card";
import { ProductGrid } from "@/components/product-grid";

export default function HomePage() {
  const featuredProducts = getHomeFeaturedProducts(5);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá, Antoér Joalheria e Relojoaria! Gostaria de falar sobre alianças sob medida."
  )}`;

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0">
          <Image
            src="/produtos/alianca-ouro-18k-pedra-4200.png"
            alt="Alianças em destaque da Antoér"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
          <div className="absolute inset-0 bg-black/20" />
        </div>
        <div className="relative mx-auto grid min-h-[78svh] max-w-7xl content-end px-4 pb-10 pt-28 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-gold">Luxo moderno para momentos especiais</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight sm:text-6xl lg:text-7xl">
              Alianças sob medida em Ouro 18k, Prata 950, Banhado a Ouro e Moeda
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              Confeccionamos diversos modelos em até 3 dias, com gravação dos nomes e caixinha inclusas como cortesia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/categorias/aliancas"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
              >
                Ver alianças <ArrowRight size={18} />
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white hover:text-ink"
              >
                <MessageCircle className="mr-2" size={18} />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        {[
          { icon: Gem, title: "Curadoria premium", text: "Peças selecionadas para presentear e celebrar com sofisticação." },
          { icon: ShieldCheck, title: "Atendimento confiável", text: "Pedido finalizado pelo WhatsApp com confirmação da equipe." },
          { icon: BadgeCheck, title: "Serviços técnicos", text: "Ajustes, polimento, banho, gravação e manutenção de relógios." }
        ].map((item) => (
          <div key={item.title} className="flex gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
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
      <HelpCard />
      <FaqSection compact />
    </>
  );
}
