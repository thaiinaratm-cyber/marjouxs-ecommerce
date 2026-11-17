import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listRecoveries } from "@/lib/admin/recovery";
import { money, orderDate } from "@/lib/orders/model";
import { recoveryLabels, recoveryStatuses, stageLabels } from "@/lib/recovery/model";

export const metadata = { title: "Recupera\u00e7\u00e3o de vendas | Marjouxs", robots: { index: false, follow: false } };
const field = "h-11 min-w-0 w-full rounded border border-black/15 bg-white px-3 font-normal focus-visible:outline-gold";

export default async function RecoveryList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const result = await listRecoveries(await searchParams);
  if (!result) return <p role="status" className="mx-auto max-w-7xl px-4 py-8">Não foi possível carregar as recuperações.</p>;
  const linkFor = (page: number) => "/admin/recuperacao?" + new URLSearchParams({
    page: String(page), ...(result.status ? { status: result.status } : {}),
    ...(result.start ? { from: result.start } : {}), ...(result.minimum ? { min: result.minimum } : {})
  }).toString();

  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <h1 className="font-serif text-3xl font-semibold text-ink">Recuperação de vendas</h1>
    <form action="/admin/recuperacao" className="mt-5 grid gap-3 border-y border-black/10 py-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
      <label className="grid min-w-0 gap-1 text-sm font-semibold">Status
        <select name="status" defaultValue={result.status ?? ""} className={field}>
          <option value="">Todos</option>
          {recoveryStatuses.map(status => <option value={status} key={status}>{recoveryLabels[status]}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-semibold">Atividade a partir de
        <input type="date" name="from" defaultValue={result.start ?? ""} className={field} />
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-semibold">Subtotal mínimo (R$)
        <input type="number" name="min" min={0} max={99999999} defaultValue={result.minimum} className={field} />
      </label>
      <button type="submit" className="min-h-11 rounded bg-ink px-4 text-sm font-semibold text-white">Filtrar</button>
      <Link href="/admin/recuperacao" className="inline-flex min-h-11 items-center justify-center rounded border border-black/15 px-4 text-sm">Limpar</Link>
    </form>
    {result.rows.length ? <ul aria-label="Recuperações" className="mt-4 divide-y divide-black/10 border-b border-black/10">
      {result.rows.map(row => <li key={row.id} className="grid min-w-0 gap-2 py-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p className="font-semibold">{row.customer_name ?? "Sem nome disponível"}</p>
          <p className="text-taupe">{row.phone_last4 ? `WhatsApp final ${row.phone_last4}` : "Contato indisponível"}</p>
          <p className="text-taupe">{orderDate(row.last_activity_at)}</p>
        </div>
        <div><p className="font-semibold">{recoveryLabels[row.status]}</p><p className="text-taupe">{stageLabels[row.stage]}</p></div>
        <div><p className="font-semibold">{money(row.subtotal_cents)}</p>
          <p className="text-taupe">{row.item_count} {Number(row.item_count) === 1 ? "item" : "itens"}{row.order_number ? ` · ${row.order_number}` : ""}</p></div>
        <Link href={`/admin/recuperacao/${row.id}`} className="inline-flex min-h-11 w-fit items-center rounded border border-black/15 px-4 font-semibold hover:border-gold">Ver recuperação</Link>
      </li>)}
    </ul> : <p className="py-8 text-sm text-taupe">Nenhuma recuperação encontrada.</p>}
    {result.count > result.pageSize || result.page > 1 ? <nav aria-label="Páginas de recuperações" className="mt-4 flex flex-wrap gap-2 text-sm">
      {result.page > 1 ? <Link href={linkFor(result.page - 1)} className="inline-flex min-h-11 items-center gap-1 px-2"><ChevronLeft size={16} aria-hidden="true" />Anterior</Link> : null}
      {result.page * result.pageSize < result.count ? <Link href={linkFor(result.page + 1)} className="inline-flex min-h-11 items-center gap-1 px-2">Próxima<ChevronRight size={16} aria-hidden="true" /></Link> : null}
    </nav> : null}
  </section>;
}
