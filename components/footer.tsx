import Link from "next/link";
import { Clock, CreditCard, Instagram, Mail, MessageCircle, MapPin, ShieldCheck, Truck } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/constants";

const atendimentoLinks = [
  { href: `https://wa.me/${WHATSAPP_NUMBER}`, label: "Falar no WhatsApp", external: true },
  { href: "/contato", label: "Fale conosco" },
  { href: "/servicos", label: "Serviços" }
];

const institutionalLinks = [
  { href: "/sobre", label: "Quem somos" },
  { href: "/politica-de-privacidade", label: "Política de privacidade" },
  { href: "/politica-de-pagamento", label: "Política de pagamento" },
  { href: "/politica-de-entrega", label: "Política de entrega" },
  { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
  { href: "/termo-de-garantia", label: "Termo de garantia" },
  { href: "/guia-de-tamanhos", label: "Guia de tamanhos" },
  { href: "/cuidados-com-joias", label: "Cuidados com joias" },
  { href: "/perguntas-frequentes", label: "Perguntas frequentes" },
  { href: "/contato", label: "Fale conosco" }
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
    <>
      <section className="border-y border-black/10 bg-white/85 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            {
              icon: CreditCard,
              title: "Pagamento facilitado",
              text: "Pix, cartão de débito e cartão de crédito."
            },
            {
              icon: Truck,
              title: "Envio e retirada",
              text: "Entrega combinada pelo atendimento ou retirada na loja."
            },
            {
              icon: ShieldCheck,
              title: "Compra segura",
              text: "Atendimento direto com nossa equipe pelo WhatsApp."
            }
          ].map((item) => (
            <div key={item.title} className="flex gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <item.icon className="mt-0.5 shrink-0 text-gold" size={22} />
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-taupe">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-black/10 bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.8fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <p className="font-serif text-3xl font-semibold">Marjouxs</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
            Joias, alianças, relógios e serviços de joalheria com atendimento personalizado.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-white/75">
            <a className="inline-flex items-center gap-2" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Atendimento pelo WhatsApp: 5511915818241
            </a>
            <span className="inline-flex items-start gap-2">
              <MapPin className="mt-0.5 shrink-0" size={16} />
              <span>
                Avenida João Manoel, 600
                <br />
                Prédio JM 600 - Térreo
                <br />
                Arujá - SP
              </span>
            </span>
            <a className="inline-flex items-center gap-2" href="https://www.instagram.com/marjouxs/" target="_blank" rel="noreferrer">
              <Instagram size={16} /> @marjouxs
            </a>
            <a className="inline-flex items-center gap-2" href="mailto:marjouxsgold@gmail.com">
              <Mail size={16} /> marjouxsgold@gmail.com
            </a>
            <span className="inline-flex items-start gap-2">
              <Clock className="mt-0.5 shrink-0" size={16} />
              <span>
                Segunda a sexta: 09:00h às 18:00h
                <br />
                Sábado: 09:00h às 13:00h
              </span>
            </span>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá, Marjouxs! Gostaria de falar com um especialista.")}`}
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Institucional</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            {institutionalLinks.map((item) => (
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
        © 2026 Marjouxs Joias e Alianças. Todos os direitos reservados.
      </div>
    </footer>
    </>
  );
}
