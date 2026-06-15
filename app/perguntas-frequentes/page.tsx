import { FaqSection } from "@/components/faq-section";
import { HelpCard } from "@/components/help-card";

export const metadata = {
  title: "Perguntas Frequentes | Marjouxs"
};

export default function FrequentlyAskedQuestionsPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Ajuda</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Perguntas frequentes</h1>
        <p className="mt-4 leading-7 text-taupe">
          Reunimos respostas rápidas sobre compra, atendimento, garantia, personalização e cuidados com as peças.
        </p>
      </section>
      <FaqSection />
      <HelpCard />
    </>
  );
}
