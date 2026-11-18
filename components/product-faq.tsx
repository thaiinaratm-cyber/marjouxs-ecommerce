import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { AnalyticsLink } from "@/components/analytics-link";
import { createSizeGuideClickEvent } from "@/lib/analytics";
import { getProductFaqTopics } from "@/lib/product-merchandising";
import type { Product } from "@/types/product";
import type { ReactNode } from "react";

const questions = {
  sizing: "Como escolher o tamanho do aro?",
  engraving: "Posso personalizar a gravação?",
  stone: "Posso escolher a cor da pedra?",
  policies: "Onde consultar garantia, trocas e devoluções?"
};

const linkClass = "font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function ProductFaq({ product }: { product: Product }) {
  const topics = getProductFaqTopics(product);
  if (!topics.length) return null;

  const answers: Record<(typeof topics)[number], ReactNode> = {
    sizing: <>
      {product.category === "Alianças"
        ? "Consulte as medidas antes de escolher os dois aros do par."
        : "Meça o diâmetro interno de um anel que sirva no dedo ou siga as orientações para medir o dedo."}
      {" "}<AnalyticsLink href="/guia-de-tamanhos" analyticsEvents={createSizeGuideClickEvent("product_page", product)} className={linkClass}>
        Ver guia de tamanhos
      </AnalyticsLink>
    </>,
    engraving: <>
      A gravação é opcional. Ao configurar o par, você pode informar o texto de cada aliança ou deixar os campos em branco.
    </>,
    stone: <>
      Escolha uma das cores disponíveis na área de compra antes de continuar. Nenhuma cor é selecionada por padrão.
    </>,
    policies: <>
      Consulte as condições e os canais de atendimento na página de{" "}
      <Link href="/garantia-e-trocas" className={linkClass}>garantia, trocas e devoluções</Link>.
    </>
  };

  return (
    <section aria-labelledby="product-faq-title" className="mt-10 border-t border-black/10 pt-6">
      <h2 id="product-faq-title" className="font-serif text-2xl font-semibold text-ink">Dúvidas frequentes</h2>
      <div className="mt-3 divide-y divide-black/10 border-b border-black/10">
        {topics.map((topic) => (
          <details key={topic} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
              {questions[topic]}
              <ChevronDown aria-hidden="true" className="shrink-0 text-gold group-open:rotate-180" size={17} strokeWidth={1.7} />
            </summary>
            <p className="max-w-prose pb-4 text-sm leading-6 text-taupe">{answers[topic]}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
