import { MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/constants";

export function HelpCard() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-black/10 bg-ink p-6 text-white shadow-soft sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Atendimento personalizado</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">Precisa de ajuda?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            Nossa equipe pode auxiliar na escolha da peça, tamanho, material, gravação e melhores condições para o seu pedido.
          </p>
        </div>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá, Antoér Joalheria e Relojoaria! Gostaria de falar com um especialista.")}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink lg:mt-0"
        >
          <MessageCircle size={18} /> Falar com especialista
        </a>
      </div>
    </section>
  );
}
