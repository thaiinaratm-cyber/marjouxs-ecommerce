import { FaqSection } from "@/components/faq-section";
import { HelpCard } from "@/components/help-card";

export const metadata = {
  title: "Ajuda | Antoér Joalheria"
};

export default function HelpPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Ajuda</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Como podemos ajudar?</h1>
          <p className="mt-4 leading-7 text-taupe">
            Reunimos orientações sobre tamanhos, cuidados, garantia, trocas, ajustes e atendimento para facilitar seu pedido.
          </p>
        </div>
      </section>
      <FaqSection />
      <HelpCard />
    </>
  );
}
