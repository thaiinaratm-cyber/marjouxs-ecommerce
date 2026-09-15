"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageCircle,
  PackageCheck,
  TriangleAlert
} from "lucide-react";
import { useEffect, useState } from "react";
import { OrderDeliveryDetails, OrderItemsList, OrderPurchaseSummary } from "@/components/order-summary";
import { OrderTimeline } from "@/components/order-timeline";
import { useCart } from "@/context/cart-context";
import { buildDefaultWhatsappUrl } from "@/lib/whatsapp";
import { formatOrderDate, shouldClearCartAfterPayment } from "@/lib/order-status";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";
import type { PublicOrder } from "@/types/checkout";

function getConfirmationCopy(order: PublicOrder) {
  if (order.paymentStatus === "paid") {
    return {
      title: "Pedido confirmado",
      text: "Recebemos seu pagamento. A equipe da Marjouxs seguirá com a preparação do pedido."
    };
  }

  if (order.paymentStatus === "pending") {
    return {
      title: "Estamos confirmando seu pagamento.",
      text: "Essa confirmação pode levar alguns instantes. Esta página será atualizada automaticamente."
    };
  }

  if (order.paymentStatus === "requires_review") {
    return {
      title: "Pagamento em análise",
      text: "Nossa equipe precisa revisar a confirmação antes de seguir com o pedido."
    };
  }

  return {
    title: "Pagamento não confirmado",
    text: "O pedido foi recebido, mas o pagamento não foi confirmado. Fale com a Marjouxs para receber orientação."
  };
}

export function OrderConfirmation({ token }: { token: string }) {
  const { lines, isReady, clearCart } = useCart();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("O identificador do pedido não foi informado.");
      return;
    }

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function loadOrder() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            body && typeof body.error === "string"
              ? body.error
              : "Não foi possível consultar o pedido."
          );
        }
        if (!active) return;

        const nextOrder = body as PublicOrder;
        setOrder(nextOrder);
        setError("");
        if (nextOrder.paymentStatus === "pending") {
          timeoutId = setTimeout(loadOrder, 3_000);
        }
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível consultar o pedido."
        );
        timeoutId = setTimeout(loadOrder, 8_000);
      }
    }

    void loadOrder();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [token]);

  useEffect(() => {
    if (
      order &&
      isReady &&
      shouldClearCartAfterPayment(order.paymentStatus, lines, order.items)
    ) {
      clearCart();
    }
  }, [clearCart, isReady, lines, order]);

  if (!order && !error) {
    return (
      <section className="mx-auto grid min-h-[60svh] max-w-3xl place-items-center px-4 py-12 text-center" aria-live="polite">
        <div>
          <LoaderCircle className="mx-auto animate-spin text-gold motion-reduce:animate-none" size={38} />
          <h1 className="mt-5 font-serif text-4xl font-semibold text-ink">
            Estamos confirmando seu pagamento.
          </h1>
          <p className="mt-3 text-taupe">Essa confirmação pode levar alguns instantes.</p>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="mx-auto grid min-h-[60svh] max-w-3xl place-items-center px-4 py-12 text-center">
        <div>
          <TriangleAlert className="mx-auto text-gold" size={38} />
          <h1 className="mt-5 font-serif text-4xl font-semibold text-ink">Não conseguimos abrir o pedido</h1>
          <p className="mt-3 text-taupe" role="alert">{error}</p>
          <a
            href={buildDefaultWhatsappUrl()}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
          >
            <MessageCircle size={18} /> Falar com a Marjouxs
          </a>
        </div>
      </section>
    );
  }

  const paid = order.paymentStatus === "paid";
  const pending = order.paymentStatus === "pending";
  const copy = getConfirmationCopy(order);
  const orderDate = formatOrderDate(order.createdAt);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-8">
        <header className="flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Pedido {order.orderNumber}
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#6f665c]">{copy.text}</p>
            {orderDate ? <p className="mt-2 text-sm text-taupe">Pedido realizado em {orderDate}.</p> : null}
          </div>
          {paid ? (
            <CheckCircle2 className="shrink-0 text-green-600" size={46} aria-hidden="true" />
          ) : pending ? (
            <Clock3 className="shrink-0 text-gold" size={44} aria-hidden="true" />
          ) : (
            <TriangleAlert className="shrink-0 text-gold" size={44} aria-hidden="true" />
          )}
        </header>

        <OrderTimeline order={order} />

        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-semibold text-ink">Itens do pedido</h2>
            <div className="mt-4">
              <OrderItemsList items={order.items} />
            </div>
          </div>
          <aside className="grid h-fit min-w-0 gap-4">
            <OrderPurchaseSummary order={order} />
            <OrderDeliveryDetails order={order} />
          </aside>
        </div>

        <section className="mt-6 rounded-md border border-gold/20 bg-gold/5 p-5" aria-labelledby="next-steps-title">
          <div className="flex items-start gap-3">
            <PackageCheck className="mt-0.5 shrink-0 text-gold" size={21} aria-hidden="true" />
            <div>
              <h2 id="next-steps-title" className="font-serif text-xl font-semibold text-ink">Próximos passos</h2>
              <p className="mt-2 text-sm leading-6 text-[#6f665c]">
                {paid
                  ? order.deliveryMethod === "pickup"
                    ? `A confecção leva ${JEWELRY_PRODUCTION_DEADLINE}. Você será avisado quando o pedido estiver pronto para retirada.`
                    : `A confecção leva ${JEWELRY_PRODUCTION_DEADLINE}. Depois, o envio seguirá pela transportadora e pelo serviço escolhidos.`
                  : "A preparação começa após a confirmação real do pagamento."}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/acompanhar-pedido?pedido=${encodeURIComponent(order.orderNumber)}`}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold sm:w-auto"
          >
            Acompanhar pedido
          </Link>
          {!paid && !pending ? (
            <a
              href={buildDefaultWhatsappUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5d] sm:w-auto"
            >
              <MessageCircle size={18} /> Falar com a Marjouxs
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
