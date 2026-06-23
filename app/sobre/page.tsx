import Image from "next/image";
import { Gem, HeartHandshake, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Sobre | Marjouxs"
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">SOBRE A MARJOUXS</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Joias para eternizar momentos especiais</h1>
          <p className="mt-4 leading-7 text-taupe">
            A Marjouxs nasceu para ajudar você a escolher joias que marcam histórias, sentimentos e conquistas. Trabalhamos com peças selecionadas, alianças, anéis, presentes especiais e serviços de joalheria, sempre com atendimento próximo e orientação personalizada.
          </p>
          <p className="mt-4 leading-7 text-taupe">
            Nossa loja virtual foi pensada para facilitar a escolha de cada peça, aproximando o cliente da nossa equipe antes da finalização da compra. Pelo WhatsApp, ajudamos com dúvidas sobre modelos, materiais, tamanhos, prazos, gravações e formas de pagamento.
          </p>
          <p className="mt-4 leading-7 text-taupe">
            Aqui, cada joia é tratada com cuidado, porque entendemos que uma aliança, um anel ou um presente especial não representa apenas uma compra, mas um momento importante na vida de quem escolhe e de quem recebe.
          </p>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-champagne shadow-soft">
          <Image
            src="/images/sobre-marjouxs-joias.png"
            alt="Joias da Marjouxs"
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
