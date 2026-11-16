"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { ORDER_TRACKING_PATH } from "@/lib/orders/tracking";

const LOOKUP_ERROR = "Não foi possível consultar o pedido agora. Tente novamente em instantes.";

export function OrderTracking() {
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    pending.current = true;
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ orderNumber: form.get("orderNumber"), phone: form.get("phone") })
      });

      if (response.status === 204) {
        window.location.assign(ORDER_TRACKING_PATH);
        return;
      }

      setError(response.status === 429 ? "Muitas tentativas. Aguarde um instante e tente novamente."
        : response.status === 404 ? "Não foi possível localizar um pedido com esses dados."
        : LOOKUP_ERROR);
    } catch {
      setError(LOOKUP_ERROR);
    }
    pending.current = false;
    setIsLoading(false);
  }

  const fieldClass = "h-12 min-w-0 w-full rounded-md border border-black/15 bg-pearl px-4 text-base font-normal text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/25";

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Acompanhe seu pedido</h1>
      <p className="mt-3 leading-7 text-[#6f665c]">Informe o número do pedido e o telefone usado na compra.</p>
      <form method="post" onSubmit={submitLookup}
        className="mt-6 grid gap-4 rounded-lg border border-black/10 bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label htmlFor="order-number" className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
          Número do pedido
          <input id="order-number" name="orderNumber" autoCapitalize="characters" autoComplete="off"
            spellCheck={false} placeholder="MJ-000123" maxLength={32} required className={fieldClass} />
        </label>
        <label htmlFor="order-phone" className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
          Telefone usado na compra
          <input id="order-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel"
            placeholder="(11) 99999-9999" maxLength={32} required className={fieldClass} />
        </label>
        <button type="submit" disabled={isLoading} aria-busy={isLoading}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60 sm:col-span-2 lg:col-span-1">
          {isLoading ? <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            : <Search size={18} aria-hidden="true" />}
          {isLoading ? "Consultando..." : "Consultar pedido"}
        </button>
      </form>
      <p aria-live="polite" aria-atomic="true" className={error ? "mt-4 text-sm leading-6 text-red-800" : "sr-only"}>
        {error}
      </p>
    </section>
  );
}
