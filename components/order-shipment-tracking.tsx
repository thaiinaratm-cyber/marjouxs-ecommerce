import { ExternalLink } from "lucide-react";
import { formatOrderDate } from "@/lib/order-status";
import { shipmentStatusLabels, type ShipmentDetails } from "@/lib/orders/shipment";

export function OrderShipmentTracking({ shipment }: { shipment: ShipmentDetails }) {
  const { carrier, code, url, status } = shipment;
  if (!carrier && !code && !url && !status) return null;
  const dates = [
    ["Enviado em", shipment.shippedAt],
    ["Em trânsito desde", shipment.inTransitAt],
    ["Entregue em", shipment.deliveredAt]
  ] as const;

  return <section aria-labelledby="tracking-heading" className="mt-6 break-words border-t border-black/10 pt-5">
    <h2 id="tracking-heading" className="font-serif text-xl font-semibold text-ink">Rastreamento</h2>
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {carrier ? <div className="min-w-0"><dt className="text-taupe">Transportadora</dt><dd className="font-semibold">{carrier}</dd></div> : null}
      {code ? <div className="min-w-0"><dt className="text-taupe">Código de rastreamento</dt><dd className="select-all font-semibold">{code}</dd></div> : null}
      {status ? <div className="min-w-0"><dt className="text-taupe">Status do envio</dt><dd className="font-semibold">{shipmentStatusLabels[status]}</dd></div> : null}
      {dates.map(([label, date]) => date ? <div key={label}><dt className="text-taupe">{label}</dt><dd><time dateTime={date}>{formatOrderDate(date)}</time></dd></div> : null)}
    </dl>
    {url ? <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-black/15 px-4 py-2 text-sm font-semibold hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:w-auto">
      Rastrear pedido <ExternalLink size={15} aria-hidden="true" />
    </a> : null}
  </section>;
}
