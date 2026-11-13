import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { listAdminOrders } from "@/lib/admin/orders";
import { money, orderDate, orderStatusLabels, paymentStatusLabels } from "@/lib/orders/model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos | Admin Marjouxs", robots: { index: false, follow: false } };
export default async function AdminOrdersPage({ searchParams: pendingSearchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = (await pendingSearchParams) ?? {};
  const { orders, count, query, counts, pageSize } = await listAdminOrders(searchParams);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const href = (page: number) => `/admin/pedidos?${new URLSearchParams({ q: query.search, status: query.status, page: String(page) })}`;
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 className="font-serif text-3xl font-semibold text-ink">Pedidos</h1>
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{["Novos / Pagos", "Em produção", "Prontos", "Enviados"].map((label, index) =>
      <div key={label} className="rounded-md border border-black/10 bg-white p-4"><p className="text-sm text-taupe">{label}</p><p className="mt-1 text-2xl font-semibold text-ink">{counts[index]}</p></div>)}</div>
    <form method="get" className="my-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="grid flex-1 gap-2 text-sm font-semibold text-ink">Buscar pedido
        <input name="q" defaultValue={query.search} placeholder="Número, nome, telefone ou e-mail" className="h-11 min-w-0 rounded-md border border-black/15 bg-white px-3 font-normal" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink">Status
        <select name="status" defaultValue={query.status} className="h-11 rounded-md border border-black/15 bg-white px-3 font-normal"><option value="">Todos</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-semibold text-white" type="submit"><Search size={16} />Buscar</button>
    </form>
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-black/10 bg-champagne/40 text-ink"><tr>{["Pedido / Data", "Cliente", "Total", "Pagamento", "Operacional", "Entrega", ""].map((label) => <th className="px-4 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead>
        <tbody>{orders.map((order) => <tr key={order.id} className="border-b border-black/5 last:border-0 hover:bg-pearl/50">
          <td className="px-4 py-4"><Link href={`/admin/pedidos/${order.id}`} className="font-semibold text-ink hover:text-gold">{order.order_number}</Link><p className="mt-1 text-xs text-taupe">{orderDate(order.created_at)}</p></td>
          <td className="max-w-60 break-words px-4 py-4 text-ink">{order.customer_name}<p className="mt-1 text-xs text-taupe">{order.customer_phone}</p></td>
          <td className="whitespace-nowrap px-4 py-4 font-semibold">{money(order.total_cents)}</td>
          <td className="px-4 py-4"><span className={order.payment_status === "paid" ? "font-semibold text-green-800" : "text-taupe"}>{paymentStatusLabels[order.payment_status] ?? order.payment_status}</span></td>
          <td className="px-4 py-4">{orderStatusLabels[order.order_status] ?? order.order_status}</td>
          <td className="max-w-52 px-4 py-4">{order.delivery_method === "pickup" ? "Retirada na loja" : <>{order.shipping_carrier}<p className="text-xs text-taupe">{order.shipping_service}</p></>}</td>
          <td className="px-4 py-4"><Link href={`/admin/pedidos/${order.id}`} className="whitespace-nowrap font-semibold text-ink hover:text-gold">Ver pedido</Link></td>
        </tr>)}</tbody>
      </table>
      {!orders.length ? <p className="p-8 text-center text-sm text-taupe">Nenhum pedido encontrado.</p> : null}
    </div>
    <nav aria-label="Paginação de pedidos" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-taupe"><span>{count} pedidos · Página {query.page} de {pages}</span><div className="flex gap-2">
      {query.page > 1 ? <Link aria-label="Página anterior" className="inline-flex h-11 w-11 items-center justify-center rounded border border-black/15" href={href(query.page - 1)}><ArrowLeft size={16} /></Link> : null}
      {query.page < pages ? <Link aria-label="Próxima página" className="inline-flex h-11 w-11 items-center justify-center rounded border border-black/15" href={href(query.page + 1)}><ArrowRight size={16} /></Link> : null}
    </div></nav>
  </div>;
}
