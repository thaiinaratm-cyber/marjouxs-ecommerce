"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, ExternalLink, LoaderCircle, MessageCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { formatCurrency } from "@/lib/format";
import { buildDefaultWhatsappUrl } from "@/lib/whatsapp";
import type { PublicOrder } from "@/types/checkout";

export function OrderConfirmation({ token }: { token: string }) {
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
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || "Não foi possível consultar o pedido.");
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
        setError(requestError instanceof Error ? requestError.message : "Não foi possível consultar o pedido.");
        timeoutId = setTimeout(loadOrder, 8_000);
      }
    }

    void loadOrder();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [token]);

  if (!order && !error) {
    return (
      <section className="mx-auto grid min-h-[60svh] max-w-3xl place-items-center px-4 py-12 text-center">
        <div>
          <LoaderCircle className="mx-auto animate-spin text-gold motion-reduce:animate-none" size={38} />
          <h1 className="mt-5 font-serif text-4xl font-semibold text-ink">Confirmando seu pagamento...</h1>
          <p className="mt-3 text-taupe">Aguarde enquanto consultamos o status seguro do seu pedido.</p>
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
          <p className="mt-3 text-taupe">{error}</p>
          <a href={buildDefaultWhatsappUrl()} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"><MessageCircle size={18} /> Falar com a Marjouxs</a>
        </div>
      </section>
    );
  }

  const paid = order.paymentStatus === "paid";
  const pending = order.paymentStatus === "pending";
  const paymentLabel = order.paymentMethod === "pix" ? "Pix" : order.paymentMethod === "credit_card" ? "Cartão de crédito" : "A confirmar";

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Pedido {order.orderNumber}</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
              {paid ? "Pagamento confirmado" : pending ? "Aguardando confirmação" : "Pagamento em análise"}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-taupe">
              {paid
                ? "Recebemos seu pagamento. A equipe da Marjouxs seguirá com a preparação do pedido."
                : pending
                  ? "A confirmação pode levar alguns instantes. Esta página será atualizada automaticamente."
                  : "Nossa equipe precisa revisar o pagamento antes de seguir com o pedido."}
            </p>
          </div>
          {paid ? <CheckCircle2 className="shrink-0 text-green-600" size={46} /> : pending ? <Clock3 className="shrink-0 text-gold" size={44} /> : <TriangleAlert className="shrink-0 text-gold" size={44} />}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="grid gap-4">
            <h2 className="font-serif text-2xl font-semibold text-ink">Itens do pedido</h2>
            {order.items.map((item) => (
              <article key={item.id} className="grid grid-cols-[76px_1fr] gap-4 rounded-md border border-black/10 p-3">
                <div className="relative aspect-square overflow-hidden rounded-md bg-champagne"><ProductImage src={item.productImage} alt={item.productName} sizes="76px" /></div>
                <div className="min-w-0">
                  <Link href={`/produtos/${item.productSlug}`} className="font-serif text-lg font-semibold text-ink hover:text-gold">{item.productName}</Link>
                  <p className="mt-1 text-sm text-taupe">{item.quantity}x {formatCurrency(item.unitPriceCents / 100)}</p>
                  {item.customization?.type === "ring_pair" ? (
                    <div className="mt-2 grid gap-1 text-sm text-taupe">
                      <p>Aliança 1: aro {item.customization.ring1.size}{item.customization.ring1.engraving ? `, gravação “${item.customization.ring1.engraving}”` : ""}</p>
                      <p>Aliança 2: aro {item.customization.ring2.size}{item.customization.ring2.engraving ? `, gravação “${item.customization.ring2.engraving}”` : ""}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-md bg-pearl p-5">
            <h2 className="font-serif text-2xl font-semibold text-ink">Resumo</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-taupe">Produtos</dt><dd className="font-medium text-ink">{formatCurrency(order.subtotalCents / 100)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-taupe">{order.deliveryMethod === "pickup" ? "Retirada" : "Frete"}</dt><dd className="font-medium text-ink">{order.deliveryMethod === "pickup" ? "Grátis" : formatCurrency(order.shippingCents / 100)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-black/10 pt-3 text-base"><dt className="font-semibold text-ink">Total</dt><dd className="font-semibold text-ink">{formatCurrency(order.totalCents / 100)}</dd></div>
            </dl>
            <div className="mt-5 grid gap-2 border-t border-black/10 pt-4 text-sm text-taupe">
              <p><strong className="text-ink">Modalidade:</strong> {order.deliveryMethod === "pickup" ? "Retirada na loja" : `${order.shippingCarrier} ${order.shippingService}`}</p>
              {order.shippingDeadlineDays !== null ? <p><strong className="text-ink">Prazo estimado:</strong> até {order.shippingDeadlineDays} dias</p> : null}
              <p><strong className="text-ink">Pagamento:</strong> {paymentLabel}</p>
              {order.installments ? <p><strong className="text-ink">Parcelas:</strong> {order.installments}x</p> : null}
            </div>
            {order.receiptUrl ? <a href={order.receiptUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-gold">Abrir comprovante <ExternalLink size={16} /></a> : null}
          </aside>
        </div>

        {!paid && !pending ? <a href={buildDefaultWhatsappUrl()} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"><MessageCircle size={18} /> Falar com a Marjouxs</a> : null}
      </div>
    </section>
  );
}
