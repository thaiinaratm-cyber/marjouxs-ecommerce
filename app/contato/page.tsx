import Image from "next/image";
import { Clock, Instagram, Mail, MapPin, MessageCircle, Navigation } from "lucide-react";
import { AnalyticsLink } from "@/components/analytics-link";
import { createContactClickEvent, createDirectionsClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { WHATSAPP_NUMBER } from "@/lib/constants";

export const metadata = {
  title: "Contato e Loja Física | Marjouxs Joalheria",
  description: "Fale com a Marjouxs Joalheria pelo WhatsApp, Instagram ou e-mail. Loja física em Arujá - SP."
};

const store = {
  name: "Marjouxs Joalheria",
  address: "Avenida João Manoel, 600 - Prédio JM 600 - Térreo - Arujá - SP",
  instagramUrl: "https://www.instagram.com/marjouxs/",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Avenida%20Jo%C3%A3o%20Manoel%20600%20Pr%C3%A9dio%20JM%20600%20Aruj%C3%A1%20SP"
};

export default function ContactPage() {
  const whatsappUrl =
    "https://wa.me/" +
    WHATSAPP_NUMBER +
    "?text=" +
    encodeURIComponent("Olá, Marjouxs! Gostaria de atendimento.");
  const contactItems = [
    {
      icon: MessageCircle,
      title: "WhatsApp oficial",
      text: "+55 11 91581-8241",
      href: whatsappUrl,
      action: "Iniciar atendimento"
    },
    {
      icon: Instagram,
      title: "Instagram",
      text: "@marjouxs",
      href: store.instagramUrl,
      action: null
    },
    {
      icon: Mail,
      title: "E-mail",
      text: "marjouxsgold@gmail.com",
      href: "mailto:marjouxsgold@gmail.com",
      action: null
    },
    {
      icon: Clock,
      title: "Atendimento",
      text: "Segunda a sexta: 09:00h às 18:00h | Sábado: 09:00h às 13:00h",
      href: null,
      action: null
    },
    {
      icon: MapPin,
      title: "Endereço",
      text: store.address,
      href: null,
      action: null
    }
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Contato</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Fale com a Marjouxs</h1>
        <p className="mt-4 leading-7 text-taupe">
          Tire dúvidas sobre alianças sob encomenda, disponibilidade de produtos, orçamento de serviços e condições de pagamento.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="grid gap-3">
          {contactItems.map((item) => {
            const cardContent = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-champagne/70 text-gold">
                  <item.icon size={20} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block font-serif text-lg font-semibold text-ink">{item.title}</strong>
                  <span className="mt-1 block break-words text-sm leading-6 text-taupe">{item.text}</span>
                  {item.action ? (
                    <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#168c45]">
                      {item.action}
                    </span>
                  ) : null}
                </span>
              </>
            );

            const analyticsEvents =
              item.title === "WhatsApp oficial"
                ? [createWhatsappClickEvent("contact"), createContactClickEvent("whatsapp")]
                : item.title === "Instagram"
                  ? createContactClickEvent("instagram")
                  : createContactClickEvent("email");

            const cardClassName =
              "group flex min-h-[92px] gap-4 rounded-lg border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-soft " +
              (item.title === "WhatsApp oficial"
                ? "border-[#25D366]/40 hover:border-[#25D366]"
                : "border-black/10 hover:border-gold/60");

            return item.href ? (
              <AnalyticsLink
                key={item.title}
                analyticsEvents={analyticsEvents}
                href={item.href}
                target={item.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={item.href.startsWith("mailto:") ? undefined : "noreferrer"}
                className={cardClassName}
              >
                {cardContent}
              </AnalyticsLink>
            ) : (
              <div key={item.title} className={cardClassName}>
                {cardContent}
              </div>
            );
          })}
        </div>

        <aside className="self-start overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="relative aspect-[1428/905] min-h-[17rem] overflow-hidden bg-champagne sm:min-h-[21rem]">
            <Image
              src="/images/loja-marjouxs.jpg"
              alt="Loja física Marjouxs Joalheria em Arujá"
              fill
              sizes="(max-width: 1023px) 100vw, 54vw"
              className="object-cover object-center"
            />
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Loja física</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">
              Visite a Marjouxs em Arujá
            </h2>
            <p className="mt-3 leading-7 text-taupe">
              Nossa equipe está pronta para ajudar na escolha de joias, alianças, serviços e atendimento personalizado.
            </p>

            <div className="mt-5 rounded-lg border border-black/10 bg-pearl p-4">
              <p className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
                <MapPin className="shrink-0 text-gold" size={19} strokeWidth={1.8} />
                {store.name}
              </p>
              <address className="mt-2 not-italic text-sm leading-6 text-taupe">
                Avenida João Manoel, 600
                <br />
                Prédio JM 600 - Térreo
                <br />
                Arujá - SP
              </address>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AnalyticsLink
                href={store.mapsUrl}
                target="_blank"
                rel="noreferrer"
                analyticsEvents={[createDirectionsClickEvent("contact"), createContactClickEvent("directions")]}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold uppercase text-white transition duration-200 hover:bg-gold"
              >
                <Navigation size={18} /> Como chegar
              </AnalyticsLink>
              <AnalyticsLink
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                analyticsEvents={[createWhatsappClickEvent("contact"), createContactClickEvent("whatsapp")]}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold uppercase text-white transition duration-200 hover:bg-[#1ebe5d]"
              >
                <MessageCircle size={18} /> Falar no WhatsApp
              </AnalyticsLink>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
