import Image from "next/image";
import { Gem, HeartHandshake, MapPin, MessageCircle, Navigation, Store } from "lucide-react";
import { AnalyticsLink } from "@/components/analytics-link";
import { createDirectionsClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { WHATSAPP_NUMBER } from "@/lib/constants";

export const metadata = {
  title: "Sobre | Marjouxs"
};

const store = {
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Avenida%20Jo%C3%A3o%20Manoel%20600%20Pr%C3%A9dio%20JM%20600%20Aruj%C3%A1%20SP"
};

export default function AboutPage() {
  const whatsappUrl =
    "https://wa.me/" +
    WHATSAPP_NUMBER +
    "?text=" +
    encodeURIComponent("Olá! Gostaria de falar com a Marjouxs.");

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">SOBRE A MARJOUXS</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">
            Joias para eternizar momentos especiais
          </h1>
          <p className="mt-4 leading-7 text-taupe">
            Na Marjouxs, você encontra joias, alianças, relógios e presentes especiais escolhidos para celebrar histórias,
            sentimentos e conquistas com elegância.
          </p>
          <p className="mt-4 leading-7 text-taupe">
            Nosso atendimento é personalizado tanto pelo WhatsApp quanto em nossa loja física em Arujá. A equipe auxilia
            na escolha de modelos, materiais, tamanhos, gravações, disponibilidade e formas de pagamento.
          </p>
          <p className="mt-4 leading-7 text-taupe">
            Também oferecemos serviços de joalheria e relojoaria, com orientação próxima antes da compra e suporte
            pós-venda para que cada escolha seja feita com mais segurança.
          </p>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-champagne shadow-soft sm:aspect-[4/3] lg:h-[480px] lg:aspect-auto">
          <Image
            src="/images/sobre-marjouxs-joias.png"
            alt="Joias da Marjouxs"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Gem,
            title: "Peças especiais",
            text: "Joias, alianças, relógios e presentes escolhidos para diferentes momentos."
          },
          {
            icon: HeartHandshake,
            title: "Atendimento próximo",
            text: "Atendimento personalizado pelo WhatsApp e também em nossa loja física em Arujá."
          },
          {
            icon: Store,
            title: "Loja física em Arujá",
            text: "Uma joalheria real, com atendimento presencial, serviços e suporte pós-venda."
          }
        ].map((item) => (
          <div key={item.title} className="h-full rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <item.icon className="text-gold" size={24} strokeWidth={1.8} />
            <h2 className="mt-4 font-serif text-2xl font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-taupe">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid overflow-hidden rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-stretch">
        <div className="relative min-h-[18rem] overflow-hidden rounded-lg bg-champagne sm:min-h-[22rem]">
          <Image
            src="/images/loja-marjouxs.jpg"
            alt="Loja física Marjouxs Joalheria em Arujá"
            fill
            sizes="(max-width: 1023px) 100vw, 58vw"
            className="object-cover object-center"
          />
        </div>

        <div className="flex flex-col justify-center px-1 pb-1 pt-6 sm:px-2 lg:px-7 lg:py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Loja física em Arujá</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Conheça nossa loja</h2>
          <p className="mt-3 leading-7 text-taupe">
            Visite a Marjouxs e conte com atendimento presencial para escolher joias, alianças, relógios e serviços.
          </p>

          <div className="mt-5 rounded-lg border border-black/10 bg-pearl p-4">
            <p className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
              <MapPin className="shrink-0 text-gold" size={19} strokeWidth={1.8} />
              Marjouxs Joalheria
            </p>
            <address className="mt-2 not-italic text-sm leading-6 text-taupe">
              Avenida João Manoel, 600
              <br />
              Prédio JM 600 - Térreo
              <br />
              Arujá - SP
            </address>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AnalyticsLink
              href={store.mapsUrl}
              target="_blank"
              rel="noreferrer"
              analyticsEvents={createDirectionsClickEvent("about")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold uppercase text-white transition duration-200 hover:bg-gold"
            >
              <Navigation size={18} /> Como chegar
            </AnalyticsLink>
            <AnalyticsLink
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              analyticsEvents={createWhatsappClickEvent("about")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold uppercase text-white transition duration-200 hover:bg-[#1ebe5d]"
            >
              <MessageCircle size={18} /> Falar no WhatsApp
            </AnalyticsLink>
          </div>
        </div>
      </div>
    </section>
  );
}
