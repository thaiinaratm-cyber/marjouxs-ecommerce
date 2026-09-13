import { formatCurrency } from "@/lib/format";
import {
  getInstallmentsText,
  getProductPagePaymentSummary,
  hasValidPrice
} from "@/lib/product-pricing";
import type { Product } from "@/types/product";

function getDiscountPercent(product: Product) {
  if (!hasValidPrice(product) || !product.oldPrice || !product.price || product.oldPrice <= product.price) {
    return null;
  }

  return product.discountPercent ?? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

function getCashPrice(product: Product) {
  if (!hasValidPrice(product) || !product.price || !product.cashDiscountPercent) {
    return null;
  }

  return product.price - product.price * (product.cashDiscountPercent / 100);
}

export function ProductPrice({ product, compact = false }: { product: Product; compact?: boolean }) {
  if (!hasValidPrice(product)) {
    return <p className={compact ? "text-lg font-semibold text-ink" : "text-2xl font-semibold text-ink"}>{product.priceLabel}</p>;
  }

  const discountPercent = getDiscountPercent(product);
  const cashPrice = compact ? getCashPrice(product) : null;
  const installmentsText = compact ? getInstallmentsText(product) : null;
  const paymentSummary = compact ? null : getProductPagePaymentSummary(product);
  const hasOldPrice = Boolean(product.oldPrice && product.price && product.oldPrice > product.price);

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {hasOldPrice && (
          <span className="text-xs text-taupe line-through">
            de {formatCurrency(product.oldPrice as number)}
          </span>
        )}
        {discountPercent ? (
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
            {discountPercent}% OFF
          </span>
        ) : null}
      </div>
      <p className={compact ? "text-xl font-semibold text-ink" : "text-3xl font-semibold text-ink"}>{formatCurrency(product.price as number)}</p>
      {cashPrice ? <p className="text-sm font-medium text-taupe">{formatCurrency(cashPrice)} à vista com desconto</p> : null}
      {installmentsText ? <p className="text-sm text-taupe">{installmentsText}</p> : null}
      {paymentSummary ? (
        <div className="mt-1 grid gap-1.5">
          <p className="text-base font-semibold text-ink sm:text-lg">
            {paymentSummary.installmentsCount}x de {formatCurrency(paymentSummary.installmentValue)}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-taupe">
            <span className="font-semibold text-gold">
              {paymentSummary.pixDiscountPercent}% OFF no Pix
            </span>
            <span className="whitespace-nowrap">
              à vista <strong className="font-semibold text-ink">{formatCurrency(paymentSummary.pixPrice)}</strong>
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
