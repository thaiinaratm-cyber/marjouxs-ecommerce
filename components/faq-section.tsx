import { ChevronDown } from "lucide-react";
import { faqItems } from "@/data/faq";

export function FaqSection({ compact = false }: { compact?: boolean }) {
  const items = compact ? faqItems.slice(0, 6) : faqItems;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Perguntas frequentes</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Dúvidas comuns antes do pedido</h2>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <details key={item.question} className="group rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
              {item.question}
              <ChevronDown className="shrink-0 text-gold transition group-open:rotate-180" size={18} />
            </summary>
            <p className="mt-3 text-sm leading-6 text-taupe">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
