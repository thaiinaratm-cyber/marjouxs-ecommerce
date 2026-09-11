import Link from "next/link";
import { BatteryCharging, Gem, Hammer, MessageCircle, PenLine, Sparkles, Watch, Wrench } from "lucide-react";
import { AnalyticsAnchor, AnalyticsLink } from "@/components/analytics-link";
import { createWhatsappClickEvent } from "@/lib/analytics";
import { WHATSAPP_NUMBER } from "@/lib/constants";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "Serviços | Marjouxs",
  description: "Serviços de joalheria e relojoaria da Marjouxs em Arujá - SP."
};

const services = [
  {
    id: "consertos-de-joias",
    title: "Consertos de joias",
    text: "Avaliação e reparo de peças com orientação direta da equipe Marjouxs.",
    icon: Wrench
  },
  {
    id: "confeccao-de-joias-personalizadas",
    title: "Confecção de joias personalizadas",
    text: "Criação de peças especiais conforme o modelo, material e acabamento desejados.",
    icon: Gem
  },
  {
    id: "banhos-em-joias",
    title: "Banhos em joias",
    text: "Serviço indicado para renovar acabamento e brilho após análise da peça.",
    icon: Sparkles
  },
  {
    id: "polimentos",
    title: "Polimentos",
    text: "Polimento profissional para recuperar o brilho e suavizar marcas de uso.",
    icon: Hammer
  },
  {
    id: "gravacao-manual-e-a-laser",
    title: "Gravação manual e a laser",
    text: "Personalização de alianças e joias com nomes, datas e mensagens especiais.",
    icon: PenLine
  },
  {
    id: "ajuste-de-aliancas",
    title: "Ajuste de alianças",
    text: "Ajustes realizados após avaliação do modelo, material e possibilidade técnica.",
    icon: Gem
  },
  {
    id: "relojoaria-em-geral",
    title: "Relojoaria em geral",
    text: "Atendimento para manutenção e avaliação de relógios.",
    icon: Watch
  },
  {
    id: "troca-de-bateria",
    title: "Troca de bateria",
    text: "Troca de bateria com conferência básica de funcionamento.",
    icon: BatteryCharging
  }
];

const serviceHeroImage = {
  src: "/images/servicos-fundicao-marjouxs.png",
  alt: "Processo especializado de joalheria na Marjouxs"
};

export default function ServicesPage() {
  const whatsappMessage = "Olá, Marjouxs! Vim pelo site e gostaria de atendimento sobre serviços.";

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-stretch">
        <Reveal distance={16} className="flex">
          <div className="flex max-w-2xl flex-col justify-center lg:max-w-none">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold sm:text-sm">Serviços Marjouxs</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Cuidado especializado para joias e relógios
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-[#6f665c]">
              A Marjouxs oferece serviços de joalheria e relojoaria com atendimento próximo, avaliação individual
              e orientação pelo WhatsApp antes da confirmação do serviço.
            </p>
            <AnalyticsAnchor
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
              analyticsEvents={createWhatsappClickEvent("services")}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold sm:w-fit"
            >
              <MessageCircle size={18} /> Solicitar atendimento
            </AnalyticsAnchor>
          </div>
        </Reveal>

        <Reveal delay={80} distance={16} className="flex">
          <figure className="relative min-h-[16rem] w-full overflow-hidden rounded-lg border border-black/10 bg-pearl shadow-soft sm:min-h-[22rem] lg:min-h-[28rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={serviceHeroImage.src}
              alt={serviceHeroImage.alt}
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover object-center transition duration-300 ease-out lg:hover:scale-[1.02]"
            />
          </figure>
        </Reveal>

        <Reveal delay={120} distance={14} className="lg:col-span-2">
          <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <p className="font-serif text-2xl font-semibold text-ink">Como funciona</p>
            <div className="mt-3 grid gap-3 text-sm leading-6 text-[#6f665c] md:grid-cols-3 md:gap-5">
              <p>O atendimento começa pelo WhatsApp ou diretamente na loja, com uma avaliação da peça.</p>
              <p>
                Condições, valores e prazos podem variar conforme o tipo de serviço, material, estado da joia ou relógio
                e disponibilidade técnica.
              </p>
              <p>A equipe confirma os detalhes antes de iniciar qualquer serviço.</p>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div className="mt-10 lg:mt-11">
          <div className="mb-5 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold sm:text-sm">Atendimento técnico</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Serviços disponíveis</h2>
          </div>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, index) => (
              <Reveal key={service.id} delay={Math.min(index, 5) * 60} distance={16} className="h-full">
                <article
                  id={service.id}
                  className="flex h-full scroll-mt-28 flex-col rounded-lg border border-black/10 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold hover:shadow-soft"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-champagne text-gold">
                    <service.icon size={20} strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 min-h-[3.5rem] font-serif text-xl font-semibold leading-snug text-ink">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6f665c]">{service.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-10 rounded-lg border border-black/10 bg-pearl p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6 lg:mt-11">
          <div className="max-w-2xl">
            <h2 className="font-serif text-2xl font-semibold text-ink">Precisa de uma avaliação?</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f665c]">
              Envie uma mensagem para a equipe da Marjouxs e confirme a melhor forma de atendimento.
            </p>
          </div>
          <AnalyticsLink
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
            analyticsEvents={createWhatsappClickEvent("services")}
            target="_blank"
            className="mt-5 inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1fb457] sm:mt-0 sm:w-auto"
          >
            <MessageCircle size={18} /> Falar no WhatsApp
          </AnalyticsLink>
        </div>
      </Reveal>
    </section>
  );
}
