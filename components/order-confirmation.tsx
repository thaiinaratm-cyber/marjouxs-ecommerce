"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, LoaderCircle, MessageCircle, PackageCheck, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { trackGoogleAdsPurchaseWhenReady } from "@/lib/google-ads";
import { OrderDeliveryDetails, OrderItemsList, OrderPurchaseSummary } from "@/components/order-summary";
import { OrderTimeline } from "@/components/order-timeline";
import { useCart } from "@/context/cart-context";
import { confirmationSupportUrl, getConfirmationCopy } from "@/lib/checkout/confirmation";
import { initialConfirmationState, startConfirmationPolling, type ConfirmationState } from "@/lib/checkout/confirmation-polling";
import { formatOrderDate, shouldClearCartAfterPayment } from "@/lib/order-status";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";
import type { ShipmentStatus } from "@/lib/orders/shipment";
import type { PublicOrder } from "@/types/checkout";

export { getConfirmationCopy } from "@/lib/checkout/confirmation";

export function OrderConfirmation({ token }: { token: string }) {
  const { lines, isReady, clearCart } = useCart();
  const [result, setResult] = useState({ token: "", state: initialConfirmationState });
  const [revision, setRevision] = useState(0);
  const previous = useRef<{ token: string; order: PublicOrder | null }>({ token: "", order: null });
  const state = result.token === token ? result.state : initialConfirmationState;

  useEffect(() => startConfirmationPolling({
    token, initialOrder: previous.current.token === token ? previous.current.order : null,
    onState: next => { previous.current = { token, order: next.order }; setResult({ token, state: next }); }
  }), [token, revision]);

  // Ads conversion is separate from GA4 purchase, which remains exclusively server/outbox.
  useEffect(() => trackGoogleAdsPurchaseWhenReady(state.order), [state.order]);
  useEffect(() => {
    if (state.order && isReady && shouldClearCartAfterPayment(state.order.paymentStatus, lines, state.order.items)) clearCart();
  }, [clearCart, isReady, lines, state.order]);

  return <OrderConfirmationView state={state} onRetry={() => setRevision(value => value + 1)} focusOnResult={revision > 0} />;
}

function SupportLink({ order }: { order: PublicOrder | null }) {
  return <a href={confirmationSupportUrl(order)} target="_blank" rel="noopener noreferrer"
    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1ebe5d] sm:w-auto">
    <MessageCircle size={18} aria-hidden="true" />Falar com a Marjouxs
  </a>;
}

export function OrderConfirmationView({ state, onRetry, focusOnResult = false, tracking = false, shipment, shipmentStatus }: {
  state: ConfirmationState; onRetry?: () => void; focusOnResult?: boolean; tracking?: boolean;
  shipment?: ReactNode; shipmentStatus?: ShipmentStatus | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnResult && !state.refreshing) heading.current?.focus({ preventScroll: true });
  }, [focusOnResult, state.phase, state.refreshing]);
  const { order, phase } = state;
  const retryAvailable = phase === "temporary_error" || phase === "pending_timeout";
  const retryButton = onRetry ? <button type="button" onClick={onRetry} disabled={state.refreshing}
    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold disabled:opacity-60 sm:w-auto">
    <RefreshCw size={17} aria-hidden="true" />Consultar novamente
  </button> : tracking ? <Link href="/acompanhar-pedido"
    className="inline-flex min-h-12 items-center justify-center px-4 text-sm font-semibold text-ink hover:text-gold">
    Voltar à consulta
  </Link> : null;

  if (!order) {
    const loading = phase === "loading";
    return <section className="mx-auto grid min-h-[60svh] max-w-3xl place-items-center px-4 py-12 text-center" aria-busy={loading}>
      <div className="w-full min-w-0">
        {loading ? <LoaderCircle className="mx-auto animate-spin text-gold motion-reduce:animate-none" size={38} aria-hidden="true" />
          : <TriangleAlert className="mx-auto text-gold" size={38} aria-hidden="true" />}
        <div role="status" aria-live="polite" aria-atomic="true">
          <h1 ref={heading} tabIndex={-1} className="mt-5 break-words font-serif text-3xl font-semibold text-ink outline-none sm:text-4xl">
            {loading ? "Consultando seu pedido" : phase === "invalid" ? "Não conseguimos abrir o pedido" : "Não foi possível consultar agora"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-[#6f665c]">
            {loading ? "Aguarde um instante enquanto consultamos a confirmação."
              : phase === "invalid" ? "Confira o link recebido ou fale com a Marjouxs para receber orientação."
                : "A consulta está temporariamente indisponível. Isso não significa que seu pagamento falhou. Você pode consultar novamente ou falar com a Marjouxs."}
          </p>
        </div>
        {!loading ? <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
          {retryAvailable ? retryButton : null}<SupportLink order={null} />
          <Link href="/" className="inline-flex min-h-12 items-center justify-center px-6 py-3 text-sm font-semibold text-ink hover:text-gold">Voltar à loja</Link>
        </div> : null}
      </div>
    </section>;
  }

  const paid = order.paymentStatus === "paid";
  const pending = order.paymentStatus === "pending";
  const copy = getConfirmationCopy(order);
  const date = formatOrderDate(order.createdAt);
  const support = retryAvailable || order.paymentStatus === "requires_review" || order.paymentStatus === "failed";
  const shippingStage = tracking && order.deliveryMethod === "shipping" ? shipmentStatus ?? order.statusStage : null;
  return <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8" aria-busy={state.refreshing}>
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-8">
      <header className="flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
          <p className="break-words text-xs font-semibold uppercase tracking-[0.2em] text-gold">Pedido {order.orderNumber}</p>
          <h1 ref={heading} tabIndex={-1} className="mt-2 break-words font-serif text-3xl font-semibold text-ink outline-none sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#6f665c]">{phase === "pending_timeout"
            ? "Estamos aguardando a confirmação. Você não precisa pagar novamente. Fale com a Marjouxs se precisar de ajuda."
            : paid && (shippingStage === "shipped" || shippingStage === "in_transit" || shippingStage === "delivered")
              ? "Recebemos seu pagamento." : copy.text}</p>
          {date ? <p className="mt-2 text-sm text-taupe">Pedido realizado em {date}.</p> : null}
        </div>
        {paid ? <CheckCircle2 className="shrink-0 text-green-600" size={46} aria-hidden="true" />
          : pending ? <Clock3 className="shrink-0 text-gold" size={44} aria-hidden="true" />
            : <TriangleAlert className="shrink-0 text-gold" size={44} aria-hidden="true" />}
      </header>
      {phase === "temporary_error" ? <p className="mt-5 rounded-md border border-gold/25 bg-gold/5 p-4 text-sm leading-6 text-ink" role="status">
        Não conseguimos atualizar a consulta agora. O status exibido é o da última consulta. Você não precisa pagar novamente.
      </p> : null}
      <OrderTimeline order={order} privateShipmentStatus={tracking ? shipmentStatus ?? null : undefined} />
      {tracking ? shipment : null}
      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0"><h2 className="font-serif text-2xl font-semibold text-ink">Itens do pedido</h2>
          <div className="mt-4"><OrderItemsList items={order.items} /></div>
        </div>
        <aside className="grid h-fit min-w-0 gap-4"><OrderPurchaseSummary order={order} /><OrderDeliveryDetails order={order} hidePrivateDetails /></aside>
      </div>
      <section className="mt-6 rounded-md border border-gold/20 bg-gold/5 p-5" aria-labelledby="next-steps-title">
        <div className="flex items-start gap-3"><PackageCheck className="mt-0.5 shrink-0 text-gold" size={21} aria-hidden="true" />
          <div className="min-w-0"><h2 id="next-steps-title" className="font-serif text-xl font-semibold text-ink">Próximos passos</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f665c]">{paid
              ? order.deliveryMethod === "pickup"
                ? order.statusStage === "ready"
                  ? "Seu pedido está disponível para retirada. Confira os dados da loja acima."
                  : order.statusStage === "picked_up"
                    ? "A retirada do seu pedido foi concluída."
                    : `A confecção leva ${JEWELRY_PRODUCTION_DEADLINE}. Confira nesta página quando o pedido estiver disponível para retirada.`
                : shippingStage === "delivered" ? "A entrega do seu pedido foi concluída."
                  : shippingStage === "in_transit" ? "Seu pedido está em trânsito. Acompanhe as atualizações nesta página."
                    : shippingStage === "shipped" ? "Seu pedido foi enviado. Confira as informações de rastreamento quando estiverem disponíveis."
                      : `A confecção leva ${JEWELRY_PRODUCTION_DEADLINE}. Depois, o envio seguirá pela transportadora e pelo serviço escolhidos.`
              : "A preparação começa após a confirmação real do pagamento."}</p>
          </div>
        </div>
      </section>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {paid && !tracking ? <a href="#andamento-do-pedido"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold sm:w-auto">Acompanhar meu pedido</a> : null}
        {tracking && !retryAvailable ? <Link href="/acompanhar-pedido"
          className="inline-flex min-h-12 items-center justify-center px-4 text-sm font-semibold text-ink hover:text-gold">Consultar outro pedido</Link> : null}
        {retryAvailable ? retryButton : null}{support ? <SupportLink order={order} /> : null}
        <Link href="/" className="inline-flex min-h-12 items-center justify-center px-6 py-3 text-sm font-semibold text-ink hover:text-gold">Voltar à loja</Link>
      </div>
    </div>
  </section>;
}
