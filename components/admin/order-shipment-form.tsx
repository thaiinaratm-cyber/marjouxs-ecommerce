import { Save } from "lucide-react";
import { updateOrderShipmentAction } from "@/app/admin/(protected)/pedidos/actions";
import { orderDate, type OrderSummary } from "@/lib/orders/model";
import { shipmentStageForAdmin, shipmentStatusLabels, shipmentStatusOptions, type ShipmentDetails } from "@/lib/orders/shipment";

const fieldClass = "min-h-11 w-full min-w-0 rounded border border-black/20 bg-white px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function OrderShipmentForm({ order, shipment }: {
  order: Pick<OrderSummary, "id" | "order_status" | "updated_at" | "shipping_carrier">;
  shipment: ShipmentDetails;
}) {
  const current = shipmentStageForAdmin(shipment.status, order.order_status);
  const options = shipmentStatusOptions(current);
  const dates = [
    [shipmentStatusLabels.shipped, shipment.shippedAt],
    [shipmentStatusLabels.in_transit, shipment.inTransitAt],
    [shipmentStatusLabels.delivered, shipment.deliveredAt]
  ] as const;

  return <section id="envio-e-rastreamento" className="scroll-mt-6 rounded-md border border-black/10 bg-white p-5" aria-labelledby="shipment-title">
    <h2 id="shipment-title" className="font-serif text-xl font-semibold">Envio e rastreamento</h2>
    <form action={updateOrderShipmentAction} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={order.id} />
      <input type="hidden" name="expectedUpdatedAt" value={order.updated_at} />
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Transportadora
        <input name="carrier" maxLength={100} defaultValue={shipment.carrier ?? ""}
          placeholder={order.shipping_carrier ?? undefined} className={fieldClass} />
      </label>
      {order.shipping_carrier ? <p className="-mt-1 break-words text-xs text-taupe">Transportadora da cotação: {order.shipping_carrier}</p> : null}
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Código de rastreamento
        <input name="code" maxLength={80} defaultValue={shipment.code ?? ""} spellCheck={false} className={fieldClass} />
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">URL de rastreamento
        <input name="url" type="url" maxLength={2048} defaultValue={shipment.url ?? ""} className={fieldClass} />
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Status do envio
        <select name="shippingStatus" defaultValue={current} className={fieldClass}>
          {options.map(status => <option key={status} value={status}>{shipmentStatusLabels[status]}</option>)}
        </select>
      </label>
      {current === "in_transit" ? <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirmDelivered" className="size-4 shrink-0 accent-gold" />
        Confirmo que o pedido foi entregue
      </label> : null}
      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-gold">
        <Save size={16} aria-hidden="true" />Salvar informações de envio
      </button>
    </form>
    {dates.some(([, date]) => date) ? <dl className="mt-4 grid gap-1 text-sm text-taupe">
      {dates.map(([label, date]) => date ? <div key={label} className="flex flex-wrap justify-between gap-x-2">
        <dt>{label}</dt><dd><time dateTime={date}>{orderDate(date)}</time></dd>
      </div> : null)}
    </dl> : null}
  </section>;
}
