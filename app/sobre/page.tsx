import Image from "next/image";
import { Gem, HeartHandshake, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Sobre | Antoér Joalheria"
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Sobre a Antoér</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Joias para marcar histórias com elegância</h1>
          <p className="mt-4 leading-7 text-taupe">
            A Antoér Joalheria e Relojoaria nasce para unir curadoria, confiança e atendimento humano. A loja virtual foi pensada para facilitar a escolha de peças especiais e aproximar o cliente da equipe antes da finalização.
          </p>
          <p className="mt-4 leading-7 text-taupe">
            Trabalhamos com produtos de preço fixo, itens sob orçamento e serviços técnicos que exigem avaliação individual, sempre com confirmação pelo WhatsApp.
          </p>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-champagne shadow-soft">
          <Image
            src="https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?auto=format&fit=crop&w=1200&q=80"
            alt="Detalhe de joia sofisticada"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { icon: Gem, title: "Peças especiais", text: "Catálogo organizado para alianças, anéis, brincos, correntes, pulseiras, pingentes e relógios." },
          { icon: HeartHandshake, title: "Atendimento próximo", text: "Checkout e orçamentos enviados pelo WhatsApp oficial para uma compra assistida." },
          { icon: ShieldCheck, title: "Preparado para crescer", text: "Estrutura pronta para painel admin, Supabase, imagens reais, pedidos e pagamentos no futuro." }
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <item.icon className="text-gold" size={24} />
            <h2 className="mt-4 font-serif text-2xl font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-taupe">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
