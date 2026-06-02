"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { paymentOptions } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { buildCheckoutUrl } from "@/lib/whatsapp";

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    address: "",
    observation: "",
    paymentMethod: paymentOptions[0]
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = buildCheckoutUrl(items, form);
    window.open(url, "_blank", "noopener,noreferrer");
    clearCart();
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto grid min-h-[55svh] max-w-3xl place-items-center px-4 py-12 text-center sm:px-6 lg:px-8">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-ink">Nenhum item no checkout</h1>
          <p className="mt-3 text-taupe">Adicione produtos ao carrinho antes de finalizar.</p>
          <Link
            href="/produtos"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            Ver produtos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Checkout</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Finalize pelo WhatsApp</h1>
        <p className="mt-4 leading-7 text-taupe">
          Sem pagamento online nesta etapa. O pedido sera enviado para confirmacao de estoque, prazo e forma de entrega.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Nome completo
            <input
              required
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="h-12 rounded-md border border-black/10 bg-pearl px-4 text-sm outline-none transition focus:border-gold"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            WhatsApp
            <input
              required
              type="tel"
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))}
              className="h-12 rounded-md border border-black/10 bg-pearl px-4 text-sm outline-none transition focus:border-gold"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Endereco ou retirada na loja
            <input
              required
              type="text"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              className="h-12 rounded-md border border-black/10 bg-pearl px-4 text-sm outline-none transition focus:border-gold"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Forma de pagamento
            <select
              value={form.paymentMethod}
              onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
              className="h-12 rounded-md border border-black/10 bg-pearl px-4 text-sm outline-none transition focus:border-gold"
            >
              {paymentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Observacoes
            <textarea
              value={form.observation}
              onChange={(event) => setForm((current) => ({ ...current, observation: event.target.value }))}
              rows={5}
              className="rounded-md border border-black/10 bg-pearl px-4 py-3 text-sm outline-none transition focus:border-gold"
              placeholder="Tamanho de aro, gravacao, prazo desejado ou duvidas."
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            <MessageCircle size={18} /> Enviar pedido no WhatsApp
          </button>
        </form>

        <aside className="h-fit rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-ink">Resumo do pedido</h2>
          <div className="mt-5 grid gap-3 text-sm">
            {items.map((item) => (
              <div key={item.product.id} className="grid gap-1 border-b border-black/10 pb-3">
                <div className="flex justify-between gap-4">
                  <span className="text-taupe">{item.quantity}x {item.product.name}</span>
                  <span className="font-medium text-ink">{item.product.priceLabel}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-taupe">Total do item</span>
                  <span className="font-semibold text-ink">
                    {item.product.price === null ? item.product.priceLabel : formatCurrency(item.product.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-2">
              <span className="text-taupe">Total</span>
              <span className="font-semibold text-ink">{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
