import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, RefreshCw, Save } from "lucide-react";
import { getAdminOrder } from "@/lib/admin/orders";
import { canSetOrderStatus, customerWhatsapp, customizationLines, deliveryLines, money, operationalStatuses, orderDate, orderStatusLabels, paymentStatusLabels } from "@/lib/orders/model";
import { reconcilePaymentAction, updateOrderStatusAction } from "@/app/admin/(protected)/pedidos/actions";
import { canReconcileAttempt, paymentReviewReason, pendingAge } from "@/lib/checkout/payment-state";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido | Admin Marjouxs", robots: { index: false, follow: false } };
const messages: Record<string, string> = {
  saved: "Status atualizado.", invalid: "Alteração não permitida para este pedido.",
  conflict: "O pedido foi alterado em outra sessão. Confira o status atual.", failed: "Não foi possível atualizar o status.",
  reconcile_paid: "Pagamento confirmado pela InfinitePay.", reconcile_already_paid: "O pedido já está pago.",
  reconcile_pending: "A InfinitePay ainda não confirmou o pagamento.",
  reconcile_review: "O pagamento precisa de conferência. Nenhuma confirmação automática foi realizada.",
  reconcile_conflict: "As referências do pagamento precisam de conferência.",
  reconcile_missing_reference: "A tentativa ainda não possui todas as referências persistidas necessárias para consultar a InfinitePay.",
  reconcile_unavailable: "Não foi possível reconciliar esta tentativa com segurança. Confira o status atual antes de tentar novamente."
};
export default async function AdminOrderPage({ params: pendingParams, searchParams: pendingSearchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ result?: string }> }) {
  const params = await pendingParams;
  const searchParams = await pendingSearchParams;
  const order = await getAdminOrder(params.id);
  if (!order) notFound();
  const whatsapp = customerWhatsapp(order);
  const statusOptions = operationalStatuses.filter((status) => canSetOrderStatus(order, status));
  const latestAttempt = [...(order.ecommerce_payment_attempts ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/pedidos" className="inline-flex items-center gap-2 text-sm font-semibold text-taupe hover:text-gold"><ArrowLeft size={16} />Pedidos</Link>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-serif text-3xl font-semibold text-ink">Pedido {order.order_number}</h1><p className="mt-2 text-sm text-taupe">{orderDate(order.created_at)}</p></div><strong className="text-2xl text-ink">{money(order.total_cents)}</strong></div>
    {searchParams?.result && messages[searchParams.result] ? <p role="status" className="mt-5 rounded border border-black/10 bg-white p-4 text-sm">{messages[searchParams.result]}</p> : null}
    {order.payment_status === "requires_review" || order.payment_status === "failed" ? <div role="status" className="mt-5 border-l-2 border-gold bg-gold/5 px-4 py-3 text-sm leading-6 text-ink"><strong>{paymentStatusLabels[order.payment_status]}</strong><p>{paymentReviewReason(latestAttempt?.failure_code)}</p>{latestAttempt && canReconcileAttempt(order.payment_status, latestAttempt) ? <form action={reconcilePaymentAction} className="mt-3"><input type="hidden" name="id" value={order.id} /><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-black/15 bg-white px-4 text-sm font-semibold hover:text-gold"><RefreshCw size={16} />Conferir novamente na InfinitePay</button><p className="mt-2 text-xs text-taupe">Exige todas as referências persistidas e nova consulta oficial. Não confirma valores manualmente.</p></form> : null}</div> : null}
    {order.payment_status === "pending" && pendingAge(order.created_at) === "old" ? <p className="mt-4 text-sm text-taupe">Pendente há mais de 24 horas. O tempo decorrido não comprova expiração do link nem cancelamento do pagamento.</p> : null}
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-7">
        <section><h2 className="font-serif text-xl font-semibold text-ink">Itens do pedido</h2>
          <div className="mt-3 divide-y divide-black/10 border-y border-black/10">{[...order.ecommerce_order_items].sort((a, b) => a.line_number - b.line_number).map((item) => <article className="flex min-w-0 gap-4 py-5" key={item.id}>
            {/^\/(?!\/)|^https:\/\//.test(item.product_image) ? <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white"><Image unoptimized fill sizes="80px" className="object-contain" src={item.product_image} alt={item.product_name} /></div> : null}
            <div className="min-w-0 flex-1 break-words"><h3 className="font-semibold text-ink">{item.product_name}</h3><p className="mt-1 text-sm text-taupe">{[item.category, item.subcategory, item.material].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-taupe">{item.product_slug} · {item.availability}</p>
              <p className="mt-2 text-sm">{item.quantity} × {money(item.unit_price_cents)} · <strong>{money(item.subtotal_cents)}</strong></p>
              {customizationLines(item).map((line, index) => <p key={index} className="mt-1 whitespace-pre-wrap text-sm text-ink">{line}</p>)}
            </div>
          </article>)}</div>
          <dl className="ml-auto mt-4 grid max-w-sm grid-cols-2 gap-2 text-sm"><dt>Subtotal</dt><dd className="text-right">{money(order.subtotal_cents)}</dd>{Number(order.discount_cents) > 0 ? <><dt>Desconto</dt><dd className="text-right">− {money(order.discount_cents)}</dd></> : null}{order.delivery_method === "shipping" ? <><dt>Frete</dt><dd className="text-right">{money(order.shipping_cents)}</dd></> : null}<dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{money(order.total_cents)}</dd></dl>
        </section>
        <section><h2 className="font-serif text-xl font-semibold text-ink">Pagamento</h2><p className="mt-3 text-sm">{order.payment_provider === "infinitepay" ? "InfinitePay" : order.payment_provider} · {paymentStatusLabels[order.payment_status] ?? order.payment_status}</p>{order.payment_method ? <p className="mt-1 text-sm text-taupe">{order.payment_method === "pix" ? "Pix" : "Cartão de crédito"}</p> : null}{order.paid_at ? <p className="mt-1 text-sm text-taupe">Pago em {orderDate(order.paid_at)}</p> : null}
          {order.payment_status === "pending" && order.payment_provider === "infinitepay" ? <form action={reconcilePaymentAction} className="mt-4"><input type="hidden" name="id" value={order.id} /><button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold sm:w-auto"><RefreshCw size={16} />Reconciliar pagamento</button></form> : null}
          <div className="mt-4 space-y-4">{[...(order.ecommerce_payment_attempts ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((attempt) => <div key={attempt.id} className="break-words border-t border-black/10 pt-3 text-sm"><p className="font-semibold">{attempt.provider} · {attempt.status}</p><p className="mt-1 text-taupe">{money(attempt.requested_amount_cents)} · {orderDate(attempt.created_at)}</p><p className="mt-1 text-taupe">Referência: {attempt.order_nsu}</p>{attempt.provider_checkout_id ? <p className="mt-1 text-taupe">Checkout: {attempt.provider_checkout_id}</p> : null}{attempt.transaction_nsu ? <p className="mt-1 text-taupe">Transação: {attempt.transaction_nsu}</p> : null}{attempt.confirmed_at ? <p className="mt-1 text-taupe">Confirmado em {orderDate(attempt.confirmed_at)}</p> : null}{attempt.capture_method ? <p className="mt-1 text-taupe">{attempt.capture_method === "pix" ? "Pix" : "Cartão de crédito"}{attempt.installments ? ` · ${attempt.installments}x` : ""}</p> : null}{attempt.paid_amount_cents != null ? <p className="mt-1 text-taupe">Valor pago no provedor: {money(attempt.paid_amount_cents)}</p> : null}</div>)}</div>
        </section>
      </div>
      <aside className="min-w-0 space-y-6">
        <section className="rounded-md border border-black/10 bg-white p-5"><h2 className="font-serif text-xl font-semibold">Status</h2><p className="mt-2 text-sm font-semibold">{orderStatusLabels[order.order_status]}</p><p className="mt-1 text-sm text-taupe">Pagamento: {paymentStatusLabels[order.payment_status] ?? order.payment_status}</p>
          <form action={updateOrderStatusAction} className="mt-4 grid gap-3"><input type="hidden" name="id" value={order.id} /><input type="hidden" name="expectedStatus" value={order.order_status} /><label className="grid gap-2 text-sm font-semibold">Status operacional<select name="status" defaultValue={statusOptions.includes(order.order_status) ? order.order_status : ""} className="h-11 w-full rounded border border-black/15 bg-white px-2 font-normal"><option disabled value="">Selecionar</option>{statusOptions.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select></label><button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-gold"><Save size={16} />Salvar status</button></form><p className="mt-3 text-xs leading-5 text-taupe">O status operacional não confirma pagamentos nem solicita estornos.</p>
        </section>
        <section className="break-words border-t border-black/10 pt-5"><h2 className="font-serif text-xl font-semibold">Cliente</h2><p className="mt-3 text-sm">{order.customer_name}</p><p className="mt-1 text-sm text-taupe">{order.customer_email}</p><p className="mt-1 text-sm text-taupe">{order.customer_phone}</p>{order.customer_cpf ? <p className="mt-1 text-sm text-taupe">CPF: {order.customer_cpf}</p> : null}{whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#187849] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#11613a]"><MessageCircle size={17} className="shrink-0" />Falar com cliente no WhatsApp</a> : null}</section>
        <section className="break-words border-t border-black/10 pt-5"><h2 className="font-serif text-xl font-semibold">Entrega</h2>{deliveryLines(order).map((line, index) => <p className="mt-2 text-sm text-taupe" key={index}>{line}</p>)}{order.delivery_method === "shipping" && order.shipping_provider ? <p className="mt-2 text-xs text-taupe">{order.shipping_provider}</p> : null}</section>
      </aside>
    </div>
  </div>;
}
