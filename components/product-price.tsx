import { formatCurrency } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
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

function getInstallmentsText(product: Product) {
  if (!hasValidPrice(product) || !product.price) {
    return null;
  }

  if (product.installmentsCount && product.installmentsCount > 0) {
    return `ou ${product.installmentsCount}x de ${formatCurrency(product.price / product.installmentsCount)} sem juros`;
  }

  return product.installments;
}

export function ProductPrice({ product, compact = false }: { product: Product; compact?: boolean }) {
  if (!hasValidPrice(product)) {
    return <p className={compact ? "text-lg font-semibold text-ink" : "text-2xl font-semibold text-ink"}>{product.priceLabel}</p>;
  }

  const discountPercent = getDiscountPercent(product);
  const cashPrice = getCashPrice(product);
  const installmentsText = getInstallmentsText(product);
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
    </div>
  );
}
