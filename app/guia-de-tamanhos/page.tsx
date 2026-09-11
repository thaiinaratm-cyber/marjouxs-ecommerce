import { MessageCircle, Ruler, ScrollText } from "lucide-react";
import { AnalyticsAnchor } from "@/components/analytics-link";
import { createWhatsappClickEvent } from "@/lib/analytics";
import { WHATSAPP_NUMBER } from "@/lib/constants";

export const metadata = {
  title: "Guia de Tamanho de Alianças e Anéis | Marjouxs",
  description: "Veja métodos simples para medir anéis e alianças e confirme a numeração com a Marjouxs antes da fabricação."
};

const whatsappMessage = "Olá, Marjouxs! Gostaria de ajuda para confirmar o tamanho do aro.";

export default function SizeGuidePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Medidas</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">
          Guia de Tamanho de Alianças e Anéis
        </h1>
        <p className="mt-4 leading-7 text-taupe">
          A escolha correta do aro ajuda a evitar ajustes e garante mais conforto. Use os métodos abaixo como orientação inicial e confirme a numeração com a equipe da Marjouxs antes da fabricação.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <Ruler className="text-gold" size={24} />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-gold">Método 1</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">Medindo um anel</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-taupe">
            <li>Coloque sobre uma régua um anel que já sirva corretamente no dedo desejado.</li>
            <li>Meça apenas a parte interna do anel.</li>
            <li>Faça a medida em milímetros.</li>
            <li>Evite incluir a espessura do metal na medição.</li>
          </ul>
        </article>

        <article className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <ScrollText className="text-gold" size={24} />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-gold">Método 2</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">Medindo o dedo</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-taupe">
            <li>Use uma fita de papel ou fita flexível ao redor do dedo.</li>
            <li>Envolva sem apertar demais.</li>
            <li>Marque o ponto de encontro da fita.</li>
            <li>Meça o comprimento em milímetros.</li>
            <li>Considere que os dedos podem variar de tamanho ao longo do dia.</li>
          </ul>
        </article>
      </div>

      <div className="mt-8 rounded-lg border border-gold/25 bg-pearl p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">Confirme antes da fabricação</h2>
          <p className="mt-2 text-sm leading-6 text-taupe">
            Para maior precisão, recomendamos confirmar a numeração diretamente com a Marjouxs antes da fabricação.
          </p>
        </div>
        <AnalyticsAnchor
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
          analyticsEvents={createWhatsappClickEvent("size_guide")}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold uppercase text-white transition hover:bg-[#1ebe5d] sm:mt-0"
        >
          <MessageCircle size={18} /> Falar com a Marjouxs no WhatsApp
        </AnalyticsAnchor>
      </div>
    </section>
  );
}