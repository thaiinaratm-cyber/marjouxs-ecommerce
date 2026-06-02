import Link from "next/link";
import { CreditCard, Instagram, MessageCircle, MapPin } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/constants";

const atendimentoLinks = [
  { href: `https://wa.me/${WHATSAPP_NUMBER}`, label: "Falar no WhatsApp", external: true },
  { href: "/contato", label: "Contato" },
  { href: "/sobre", label: "Sobre a Antoér" },
  { href: "/servicos", label: "Serviços" }
];

const ajudaLinks = [
  { href: "/ajuda", label: "Guia de tamanhos" },
  { href: "/garantia-e-trocas", label: "Garantia e trocas" },
  { href: "/ajuda", label: "Cuidados com joias" },
  { href: "/ajuda", label: "Perguntas frequentes" }
];

const categoriaLinks = [
  { href: "/categorias/aliancas", label: "Alianças" },
  { href: "/categorias/aneis", label: "Anéis" },
  { href: "/categorias/brincos", label: "Brincos" },
  { href: "/categorias/correntes", label: "Correntes" },
  { href: "/categorias/pulseiras", label: "Pulseiras" },
  { href: "/categorias/pingentes", label: "Pingentes" },
  { href: "/categorias/relogios", label: "Relógios" },
  { href: "/servicos", label: "Serviços" }
];

export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.8fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <p className="font-serif text-3xl font-semibold">Antoér Joalheria e Relojoaria</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
            Joias, alianças, relógios e serviços de joalheria com atendimento personalizado.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-white/75">
            <a className="inline-flex items-center gap-2" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Atendimento pelo WhatsApp: 5511919964393
            </a>
            <span className="inline-flex items-center gap-2">
              <MapPin size={16} /> Atendimento em São Paulo
            </span>
            <span className="inline-flex items-center gap-2">
              <Instagram size={16} /> @antoerjoalheria
            </span>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá, Antoér Joalheria e Relojoaria! Gostaria de falar com um especialista.")}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
          >
            <MessageCircle size={18} /> Falar com especialista
          </a>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Atendimento</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            {atendimentoLinks.map((item) =>
              item.external ? (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} href={item.href}>
                  {item.label}
                </Link>
              )
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Ajuda</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            {ajudaLinks.map((item) => (
              <Link key={item.label} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Categorias</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            {categoriaLinks.map((item) => (
              <Link key={item.label} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-white/70 sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 font-semibold text-white">
            <CreditCard size={17} className="text-gold" /> Formas de pagamento
          </p>
          <p>Pix, dinheiro, cartão de débito e cartão de crédito.</p>
          <p className="text-xs text-white/50">Condições de parcelamento podem variar conforme produto, material e forma de pagamento.</p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/50">
        © 2026 Antoér Joalheria e Relojoaria. Estrutura preparada para catálogo, pedidos e integrações futuras.
      </div>
    </footer>
  );
}
