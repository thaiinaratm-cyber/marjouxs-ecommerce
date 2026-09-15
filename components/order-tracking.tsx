"use client";

import { LoaderCircle, MessageCircle, PackageSearch, Search, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { OrderDeliveryDetails, OrderItemsList, OrderPurchaseSummary } from "@/components/order-summary";
import { OrderTimeline } from "@/components/order-timeline";
import { buildDefaultWhatsappUrl } from "@/lib/whatsapp";
import { formatOrderDate, getOrderTimeline } from "@/lib/order-status";
import type { PublicOrder } from "@/types/checkout";

function getStatusCopy(order: PublicOrder) {
  if (order.paymentStatus === "pending") {
    return {
      title: "Estamos confirmando seu pagamento.",
      text: "Essa confirmação pode levar alguns instantes. O andamento será atualizado após a confirmação real."
    };
  }

  if (order.paymentStatus === "failed") {
    return {
      title: "Pagamento não confirmado",
      text: "O pedido foi recebido, mas o pagamento não foi confirmado. Fale com a Marjouxs para receber orientação."
    };
  }

  if (order.paymentStatus === "requires_review") {
    return {
      title: "Pagamento em análise",
      text: "Nossa equipe precisa revisar a confirmação antes de seguir com o pedido."
    };
  }

  const currentStep = getOrderTimeline(order).find((step) => step.state === "current");
  return {
    title: currentStep?.label || "Pagamento aprovado",
    text:
      order.deliveryMethod === "pickup"
        ? "Acompanhe a preparação. Você será avisado quando o pedido estiver pronto para retirada."
        : "Acompanhe a preparação e, depois, o envio pela modalidade escolhida."
  };
}

export function OrderTracking({ initialOrderNumber = "" }: { initialOrderNumber?: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body && typeof body.error === "string"
            ? body.error
            : "Não foi possível consultar o pedido agora."
        );
      }

      setOrder(body as PublicOrder);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Não foi possível consultar o pedido agora."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const statusCopy = order ? getStatusCopy(order) : null;
  const orderDate = order ? formatOrderDate(order.createdAt) : null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Seu pedido</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">
          Acompanhar pedido
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-[#6f665c]">
          Informe o número do pedido e o mesmo e-mail usado na compra para consultar o andamento com segurança.
        </p>
      </header>

      <form
        onSubmit={submitLookup}
        className="mt-8 grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1.35fr_auto] sm:items-end sm:p-6"
      >
        <label htmlFor="order-number" className="grid gap-2 text-sm font-semibold text-ink">
          Número do pedido
          <input
            id="order-number"
            name="orderNumber"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="MJ-000123"
            required
            className="h-12 min-w-0 rounded-md border border-black/10 bg-pearl px-4 font-normal uppercase text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
          />
        </label>
        <label htmlFor="order-email" className="grid gap-2 text-sm font-semibold text-ink">
          E-mail usado na compra
          <input
            id="order-email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
            className="h-12 min-w-0 rounded-md border border-black/10 bg-pearl px-4 font-normal text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} />
          ) : (
            <Search size={18} />
          )}
          {isLoading ? "Consultando..." : "Acompanhar pedido"}
        </button>
      </form>

      <div aria-live="polite">
        {error ? (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
            <TriangleAlert className="mt-0.5 shrink-0" size={19} />
            <p>{error}</p>
          </div>
        ) : null}

        {order && statusCopy ? (
          <div className="mt-8 grid gap-6">
            <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="tracking-status-title">
              <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                    Pedido {order.orderNumber}
                  </p>
                  <h2 id="tracking-status-title" className="mt-2 font-serif text-3xl font-semibold text-ink">
                    {statusCopy.title}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-7 text-[#6f665c]">{statusCopy.text}</p>
                  {orderDate ? <p className="mt-2 text-sm text-taupe">Pedido realizado em {orderDate}.</p> : null}
                </div>
                <PackageSearch className="shrink-0 text-gold" size={36} aria-hidden="true" />
              </div>
              <OrderTimeline order={order} />
            </section>

            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <h2 className="font-serif text-2xl font-semibold text-ink">Produtos do pedido</h2>
                <div className="mt-4">
                  <OrderItemsList items={order.items} />
                </div>
              </div>
              <aside className="grid h-fit min-w-0 gap-4">
                <OrderDeliveryDetails order={order} />
                <OrderPurchaseSummary order={order} />
              </aside>
            </div>

            {order.paymentStatus === "failed" || order.paymentStatus === "requires_review" ? (
              <a
                href={buildDefaultWhatsappUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5d] sm:w-fit"
              >
                <MessageCircle size={18} /> Falar com a Marjouxs
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
