import { Clock, Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/constants";

export const metadata = {
  title: "Contato | Antoér Joalheria"
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Contato</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Fale com a Antoér</h1>
        <p className="mt-4 leading-7 text-taupe">
          Tire dúvidas sobre alianças sob encomenda, disponibilidade de produtos, orçamento de serviços e condições de pagamento.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          {[
            { icon: MessageCircle, title: "WhatsApp oficial", text: "+55 11 91996-4393", href: `https://wa.me/${WHATSAPP_NUMBER}` },
            { icon: Instagram, title: "Instagram", text: "@antoerjoalheria" },
            { icon: Mail, title: "E-mail", text: "contato@antoer.com.br" },
            { icon: Clock, title: "Atendimento", text: "Segunda a sábado, em horário comercial" },
            { icon: MapPin, title: "Localização", text: "São Paulo, SP" }
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              target={item.href ? "_blank" : undefined}
              rel={item.href ? "noreferrer" : undefined}
              className="flex gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm transition hover:border-gold"
            >
              <item.icon className="mt-1 shrink-0 text-gold" size={22} />
              <span>
                <strong className="block font-serif text-xl text-ink">{item.title}</strong>
                <span className="mt-1 block text-sm text-taupe">{item.text}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-3xl font-semibold text-ink">Mensagem rápida</h2>
          <p className="mt-2 text-sm leading-6 text-taupe">Use o botão abaixo para abrir o WhatsApp com uma conversa direta.</p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá, Antoér Joalheria e Relojoaria! Gostaria de atendimento.")}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            <MessageCircle size={18} /> Iniciar atendimento
          </a>
        </div>
      </div>
    </section>
  );
}
