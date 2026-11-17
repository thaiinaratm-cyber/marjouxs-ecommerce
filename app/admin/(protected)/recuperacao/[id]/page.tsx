import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { readRecovery } from "@/lib/admin/recovery";
import { ignoreRecoveryAction } from "@/app/admin/(protected)/recuperacao/actions";
import { money, orderDate } from "@/lib/orders/model";
import { recoveryLabels, recoveryWhatsapp, stageLabels } from "@/lib/recovery/model";
import { stoneColorLabel } from "@/lib/stone-customization";

export const metadata = { title: "Recupera\u00e7\u00e3o de venda | Marjouxs", robots: { index: false, follow: false } };

export default async function RecoveryDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ resultado?: string }>;
}) {
  const row = await readRecovery((await params).id);
  if (row === null) notFound();
  if (!row) return <p role="status" className="mx-auto max-w-4xl px-4 py-8">Não foi possível carregar esta recuperação.</p>;
  const whatsapp = recoveryWhatsapp(row.customer_phone, row.contact_allowed, row.status);
  const result = (await searchParams).resultado;
  return <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <Link href="/admin/recuperacao" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} aria-hidden="true" />Recuperação de vendas</Link>
    <h1 className="font-serif text-3xl font-semibold">Detalhe da recuperação</h1>
    {result ? <p role="status" className="mt-3 text-sm">{result === "ignorado" ? "Recuperação ignorada." : "A recuperação não pôde ser alterada."}</p> : null}
    <dl className="mt-5 grid min-w-0 gap-4 border-y border-black/10 py-5 text-sm [overflow-wrap:anywhere] sm:grid-cols-2">
      <div><dt className="text-taupe">Cliente</dt><dd>{row.customer_name ?? "Sem nome disponível"}</dd></div>
      <div><dt className="text-taupe">WhatsApp</dt><dd>{row.customer_phone ?? "Contato indisponível"}</dd></div>
      <div><dt className="text-taupe">Etapa</dt><dd>{stageLabels[row.stage]}</dd></div>
      <div><dt className="text-taupe">Status</dt><dd>{recoveryLabels[row.status]}</dd></div>
      <div><dt className="text-taupe">Última atividade</dt><dd>{orderDate(row.last_activity_at)}</dd></div>
      <div><dt className="text-taupe">Expiração</dt><dd>{orderDate(row.expires_at)}</dd></div>
      <div><dt className="text-taupe">Modalidade</dt><dd>{row.delivery_method === "pickup" ? "Retirada na loja" : "Entrega"}</dd></div>
      <div><dt className="text-taupe">Subtotal estimado</dt><dd>{money(row.subtotal_cents)}</dd></div>
      {row.order_id ? <div><dt className="text-taupe">Pedido vinculado</dt><dd><Link href={`/admin/pedidos/${row.order_id}`} className="underline">{row.order_number ?? "Ver pedido"}</Link></dd></div> : null}
    </dl>
    <h2 className="mt-5 font-serif text-xl font-semibold">Última sacola registrada</h2>
    {row.cart_items.length ? <ul className="mt-2 divide-y divide-black/10 text-sm">
      {row.cart_items.map(({ name, quantity, productId, unitPriceCents, customization }, index) => <li key={`${productId}:${index}`} className="py-3 [overflow-wrap:anywhere]">
        <p className="font-semibold">{name}</p>
        <p>{quantity} × {money(unitPriceCents)}</p>
        {customization?.type === "ring_pair" ? <>
          <p>Aros: {customization.ring1.size} e {customization.ring2.size}</p>
          {customization.ring1.engraving ? <p>Gravação 1: {customization.ring1.engraving}</p> : null}
          {customization.ring2.engraving ? <p>Gravação 2: {customization.ring2.engraving}</p> : null}
        </> : null}
        {customization?.stone_color ? <p>Pedra: {stoneColorLabel(customization.stone_color)}</p> : null}
      </li>)}
    </ul> : <p className="mt-2 text-sm text-taupe">Dados da sacola indisponíveis.</p>}
    <div className="mt-5 flex flex-wrap gap-3">
      {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded bg-[#187849] px-3 py-2 text-sm font-semibold text-white">
        <MessageCircle size={16} className="shrink-0" aria-hidden="true" />Falar com cliente no WhatsApp</a> : null}
      {row.status === "active" || row.status === "abandoned" ? <form action={ignoreRecoveryAction}>
        <input type="hidden" name="id" value={row.id} />
        <button type="submit" className="min-h-11 rounded border border-black/15 px-3 text-sm font-semibold">Marcar como ignorado</button>
      </form> : null}
    </div>
  </section>;
}
