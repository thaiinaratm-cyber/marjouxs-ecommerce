import Link from "next/link";
import { Clock3, ExternalLink, MapPin, PackageCheck, Truck } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { STORE_ADDRESS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { getShippingAddressLines } from "@/lib/order-status";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";
import type { PublicOrder, PublicOrderItem } from "@/types/checkout";

function RingCustomization({ item }: { item: PublicOrderItem }) {
  if (item.customization?.type !== "ring_pair") return null;

  return (
    <dl className="mt-3 grid gap-3 rounded-md border border-gold/15 bg-gold/5 p-3 text-sm sm:grid-cols-2">
      {[
        { label: "Aliança 1", ring: item.customization.ring1 },
        { label: "Aliança 2", ring: item.customization.ring2 }
      ].map(({ label, ring }) => (
        <div key={label} className="min-w-0">
          <dt className="font-semibold text-ink">{label}</dt>
          <dd className="mt-1 text-taupe">Aro: {ring.size}</dd>
          <dd className="break-words text-taupe">
            Gravação: {ring.engraving?.trim() || "Sem gravação"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function OrderItemsList({ items }: { items: PublicOrderItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <article
          key={`${item.productSlug}-${index}`}
          className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4 sm:p-4"
        >
          <div className="relative aspect-square overflow-hidden rounded-md bg-champagne">
            <ProductImage src={item.productImage} alt={item.productName} sizes="(max-width: 640px) 72px, 88px" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/produtos/${item.productSlug}`}
              className="font-serif text-base font-semibold leading-5 text-ink transition hover:text-gold sm:text-lg"
            >
              {item.productName}
            </Link>
            {item.material ? <p className="mt-1 text-xs text-taupe">{item.material}</p> : null}
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span className="text-taupe">
                {item.quantity}x {formatCurrency(item.unitPriceCents / 100)}
              </span>
              <strong className="font-semibold text-ink">
                {formatCurrency(item.subtotalCents / 100)}
              </strong>
            </div>
            <RingCustomization item={item} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function OrderPurchaseSummary({ order }: { order: PublicOrder }) {
  const paymentLabel =
    order.paymentMethod === "pix"
      ? "Pix"
      : order.paymentMethod === "credit_card"
        ? "Cartão de crédito"
        : "A confirmar";

  return (
    <section className="rounded-md border border-black/10 bg-pearl p-5" aria-labelledby="order-summary-title">
      <h2 id="order-summary-title" className="font-serif text-2xl font-semibold text-ink">
        Resumo
      </h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-taupe">Subtotal</dt>
          <dd className="font-medium text-ink">{formatCurrency(order.subtotalCents / 100)}</dd>
        </div>
        {order.discountCents > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-taupe">Desconto</dt>
            <dd className="font-medium text-ink">-{formatCurrency(order.discountCents / 100)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-taupe">{order.deliveryMethod === "pickup" ? "Retirada" : "Frete"}</dt>
          <dd className="font-medium text-ink">
            {order.deliveryMethod === "pickup" ? "Grátis" : formatCurrency(order.shippingCents / 100)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-black/10 pt-3 text-base">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="font-semibold text-ink">{formatCurrency(order.totalCents / 100)}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-taupe">
        <p>
          <strong className="text-ink">Pagamento:</strong> {paymentLabel}
        </p>
        {order.installments ? (
          <p>
            <strong className="text-ink">Parcelas:</strong> {order.installments}x
          </p>
        ) : null}
      </div>
      {order.receiptUrl ? (
        <a
          href={order.receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-gold"
        >
          Abrir comprovante <ExternalLink size={16} />
        </a>
      ) : null}
    </section>
  );
}

export function OrderDeliveryDetails({ order }: { order: PublicOrder }) {
  const shippingAddressLines = order.shippingAddress
    ? getShippingAddressLines(order.shippingAddress)
    : [];

  return (
    <section className="rounded-md border border-black/10 bg-white p-5" aria-labelledby="delivery-details-title">
      <div className="flex items-start gap-3">
        {order.deliveryMethod === "pickup" ? (
          <PackageCheck className="mt-0.5 shrink-0 text-gold" size={21} />
        ) : (
          <Truck className="mt-0.5 shrink-0 text-gold" size={21} />
        )}
        <div className="min-w-0">
          <h2 id="delivery-details-title" className="font-serif text-xl font-semibold text-ink">
            {order.deliveryMethod === "pickup" ? "Retirada na loja" : "Entrega"}
          </h2>
          {order.deliveryMethod === "pickup" ? (
            <address className="mt-2 not-italic text-sm leading-6 text-taupe">
              <span className="block">{STORE_ADDRESS.street}</span>
              <span className="block">{STORE_ADDRESS.complement}</span>
              <span className="block">{STORE_ADDRESS.city} - {STORE_ADDRESS.state}</span>
            </address>
          ) : shippingAddressLines.length > 0 ? (
            <address className="mt-2 not-italic text-sm leading-6 text-taupe">
              {shippingAddressLines.map((line) => (
                <span key={line} className="block break-words">{line}</span>
              ))}
            </address>
          ) : (
            <p className="mt-2 text-sm text-taupe">O endereço não está disponível nesta consulta.</p>
          )}
        </div>
      </div>

      {order.deliveryMethod === "shipping" && (order.shippingCarrier || order.shippingService) ? (
        <div className="mt-4 flex gap-3 border-t border-black/10 pt-4 text-sm leading-6">
          <MapPin className="mt-0.5 shrink-0 text-gold" size={18} />
          <p className="text-taupe">
            <strong className="text-ink">Transporte:</strong>{" "}
            {[order.shippingCarrier, order.shippingService].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : null}

      {order.trackingCode ? (
        <p className="mt-3 break-all text-sm text-taupe">
          <strong className="text-ink">Código de rastreio:</strong> {order.trackingCode}
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 border-t border-black/10 pt-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="inline-flex items-center gap-2 text-taupe">
            <Clock3 className="shrink-0 text-gold" size={17} /> Confecção
          </dt>
          <dd className="text-right font-medium text-ink">{JEWELRY_PRODUCTION_DEADLINE}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-taupe">{order.deliveryMethod === "pickup" ? "Próximo passo" : "Transporte"}</dt>
          <dd className="max-w-[65%] text-right font-medium text-ink">
            {order.deliveryMethod === "pickup"
              ? "Você será avisado quando o pedido estiver pronto."
              : order.shippingDeadlineDays !== null
                ? `Prazo do serviço: até ${order.shippingDeadlineDays} dias`
                : "Prazo conforme o serviço selecionado"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
