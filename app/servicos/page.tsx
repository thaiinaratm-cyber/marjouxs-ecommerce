import Link from "next/link";
import { MessageCircle, Wrench } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { WHATSAPP_NUMBER } from "@/lib/constants";
import { getProductsByCategory } from "@/lib/products";

export const metadata = {
  title: "Serviços | Antoér Joalheria"
};

export default function ServicesPage() {
  const services = getProductsByCategory("Serviços");

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Serviços técnicos</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Cuidado especializado para joias e relógios</h1>
          <p className="mt-4 leading-7 text-taupe">
            Avaliação, reparo, polimento, banho, gravação, ajuste de alianças, troca de bateria e conserto de relógios.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            <MessageCircle size={18} /> Solicitar avaliação
          </a>
        </div>
        <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:grid-cols-2">
          {["Conserto de joias", "Banho de joias", "Polimento", "Gravação", "Ajuste de alianças", "Troca de bateria"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-md bg-pearl p-4">
              <Wrench className="text-gold" size={18} />
              <span className="text-sm font-medium text-ink">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl font-semibold text-ink">Serviços cadastrados</h2>
          <Link href="/produtos" className="text-sm font-semibold text-ink hover:text-gold">
            Ver catálogo completo
          </Link>
        </div>
        <ProductGrid products={services} />
      </div>
    </section>
  );
}
