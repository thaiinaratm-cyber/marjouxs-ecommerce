import type { Metadata } from "next";
import { HelpCard } from "@/components/help-card";
import { absoluteUrl } from "@/lib/seo";
import { buildDefaultWhatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Garantia, Trocas e Devoluções | Marjouxs",
  description:
    "Conheça as condições de garantia, trocas e devoluções da Marjouxs, os prazos para compras online, reembolso e canais de atendimento.",
  alternates: {
    canonical: absoluteUrl("/garantia-e-trocas")
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function WarrantyPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Atendimento e cuidado</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Garantia, Trocas e Devoluções</h1>
        <section className="mt-6 grid gap-5 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="garantia">
          <h2 id="garantia" className="font-serif text-2xl font-semibold text-ink">Garantia</h2>
          <p>
            A Marjouxs oferece garantia para produtos adquiridos em nossa loja, conforme as condições
            de cada peça e serviço.
          </p>
          <p>
            O cliente pode solicitar análise em caso de defeito de fabricação. A peça passará por avaliação técnica e,
            sendo confirmado defeito de fabricação, será realizado reparo, ajuste ou substituição conforme o caso.
          </p>
          <p>
            A garantia não cobre mau uso, quedas, riscos, desgaste natural, contato com produtos químicos, oxidação por
            uso inadequado ou danos causados por terceiros.
          </p>
          <p>
            Para solicitar atendimento, entre em contato pelo WhatsApp da Marjouxs e envie fotos da peça,
            comprovante de compra e descrição do ocorrido.
          </p>
        </section>

        <div className="mt-8 grid gap-6 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <section className="grid gap-3 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="compras-online">
            <h2 id="compras-online" className="font-serif text-2xl font-semibold text-ink">
              Trocas e Devoluções — Compras Online
            </h2>
            <p>
              Para compras realizadas pelo site, o cliente poderá solicitar a devolução por arrependimento no prazo de
              até 7 dias corridos contados a partir do recebimento do produto, conforme a legislação aplicável.
            </p>
            <p>
              Para solicitar uma troca ou devolução, entre em contato com a Marjouxs pelo WhatsApp ou pelos canais de
              atendimento informados no site.
            </p>
            <p>
              O produto deverá ser devolvido em condições adequadas, acompanhado de seus acessórios e embalagem quando aplicável.
            </p>
            <p>
              Após o recebimento da peça, ela poderá passar por conferência antes da conclusão do processo de devolução.
            </p>
          </section>

          <section className="grid gap-3 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="reembolso">
            <h2 id="reembolso" className="font-serif text-2xl font-semibold text-ink">Reembolso</h2>
            <p>
              Após a aprovação da devolução, o reembolso será processado em até 7 dias, utilizando forma compatível com
              o meio de pagamento utilizado na compra, observados os prazos da instituição financeira ou operadora responsável.
            </p>
          </section>

          <section className="grid gap-3 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="formas-de-devolucao">
            <h2 id="formas-de-devolucao" className="font-serif text-2xl font-semibold text-ink">Formas de Devolução</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Na loja física da Marjouxs;</li>
              <li>Por envio, mediante contato prévio com nosso atendimento para receber as orientações.</li>
            </ul>
            <p>
              Os procedimentos e eventuais custos de envio serão informados pelo atendimento de acordo com o motivo
              da devolução e a legislação aplicável.
            </p>
          </section>

          <section className="grid gap-3 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="produtos-personalizados">
            <h2 id="produtos-personalizados" className="font-serif text-2xl font-semibold text-ink">
              Produtos Personalizados / Sob Encomenda
            </h2>
            <p>
              Produtos confeccionados sob encomenda, personalizados, gravados ou produzidos em medidas específicas possuem
              características próprias. Solicitações envolvendo essas peças serão analisadas individualmente, observadas as
              características da encomenda e os direitos previstos na legislação aplicável.
            </p>
          </section>

          <section className="grid gap-3 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="servicos">
            <h2 id="servicos" className="font-serif text-2xl font-semibold text-ink">Serviços</h2>
            <p>
              Serviços de conserto, banho, polimento, gravação e outros serviços realizados pela Marjouxs possuem condições próprias.
            </p>
          </section>

          <section className="grid gap-3 text-sm leading-7 text-taupe sm:text-base" aria-labelledby="contato">
            <h2 id="contato" className="font-serif text-2xl font-semibold text-ink">Contato</h2>
            <p>Precisa solicitar uma troca, devolução ou atendimento de garantia?</p>
            <p>
              Entre em contato com a Marjouxs pelo{" "}
              <a
                href={buildDefaultWhatsappUrl()}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ink underline underline-offset-4"
              >
                WhatsApp
              </a>.
            </p>
            <address className="not-italic">
              <span className="font-semibold text-ink">Loja física:</span><br />
              Avenida João Manoel, 600 - Centro<br />
              Arujá - SP<br />
              CEP 07400-610
            </address>
          </section>
        </div>
      </section>
      <HelpCard />
    </>
  );
}
