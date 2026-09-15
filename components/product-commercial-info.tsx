import {
  BadgeCheck,
  BadgePercent,
  Clock3,
  Coins,
  CreditCard,
  Gem,
  Gift,
  HeartHandshake,
  MapPin,
  PackageCheck,
  Ruler,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import {
  getProductCommercialDetails,
  getProductTrustBenefits,
  type ProductCommercialDetailKind,
  type ProductTrustBenefitKind
} from "@/lib/product-merchandising";
import type { Product } from "@/types/product";

const commercialIcons: Record<ProductCommercialDetailKind, LucideIcon> = {
  material: Gem,
  availability: PackageCheck,
  sizing: Ruler,
  production: Clock3,
  pair: Coins,
  included: Gift,
  warranty: BadgeCheck
};

const trustIcons: Record<ProductTrustBenefitKind, LucideIcon> = {
  secure: ShieldCheck,
  custom: Clock3,
  installments: CreditCard,
  pix: BadgePercent,
  store: MapPin,
  aftercare: HeartHandshake
};

export function ProductCommercialInfo({ product }: { product: Product }) {
  const details = getProductCommercialDetails(product);

  if (details.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Informações comerciais do produto"
      className="mt-4 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
    >
      <dl className="grid sm:grid-cols-2">
        {details.map((detail) => {
          const Icon = commercialIcons[detail.kind];

          return (
            <div
              key={detail.kind}
              className="flex min-w-0 gap-3 border-b border-black/10 p-4 last:border-b-0 sm:border-b-0 sm:[&:nth-child(even)]:border-l sm:[&:nth-child(n+3)]:border-t"
            >
              <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-gold" size={17} strokeWidth={1.7} />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-taupe">{detail.label}</dt>
                <dd className="mt-1 text-sm font-medium leading-5 text-ink">{detail.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>

    </section>
  );
}

export function ProductTrustBlock({ product }: { product: Product }) {
  const benefits = getProductTrustBenefits(product);

  return (
    <div
      aria-label="Segurança e condições de compra"
      className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-black/10 bg-pearl p-4 text-xs font-medium leading-5 text-ink sm:text-sm"
    >
      {benefits.map((benefit) => {
        const Icon = trustIcons[benefit.kind];

        return (
          <p key={benefit.kind} className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden="true" className="shrink-0 text-gold" size={17} strokeWidth={1.7} />
            <span>{benefit.label}</span>
          </p>
        );
      })}
    </div>
  );
}
