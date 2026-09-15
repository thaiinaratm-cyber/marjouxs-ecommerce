"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { OverlayDrawer } from "@/components/overlay-drawer";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/context/cart-context";
import { trackViewCart } from "@/lib/analytics";
import { isAlliance } from "@/lib/checkout/catalog";
import { formatCurrency } from "@/lib/format";
import type { RingPairCustomization } from "@/types/product";

function AllianceCustomization({ customization }: { customization: RingPairCustomization }) {
  return (
    <dl className="mt-3 grid gap-2 rounded-md bg-pearl p-3 text-xs leading-5">
      <div className="grid grid-cols-[4.5rem_1fr] gap-2">
        <dt className="font-semibold text-ink">Aliança 1</dt>
        <dd className="text-taupe">
          Aro {customization.ring1.size} · {customization.ring1.engraving || "Sem gravação"}
        </dd>
      </div>
      <div className="grid grid-cols-[4.5rem_1fr] gap-2">
        <dt className="font-semibold text-ink">Aliança 2</dt>
        <dd className="text-taupe">
          Aro {customization.ring2.size} · {customization.ring2.engraving || "Sem gravação"}
        </dd>
      </div>
    </dl>
  );
}

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, totalItems, isReady, removeItem, updateQuantity } = useCart();
  const trackedOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      trackedOpen.current = false;
      return;
    }

    if (isReady && items.length > 0 && !trackedOpen.current) {
      trackedOpen.current = true;
      trackViewCart(items);
    }
  }, [isReady, items, open]);

  return (
    <OverlayDrawer
      open={open}
      onClose={onClose}
      eyebrow="Sua seleção"
      title={`Sacola${totalItems > 0 ? ` (${totalItems})` : ""}`}
      footer={
        items.length > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-taupe">Subtotal</span>
              <strong className="font-serif text-2xl text-ink">{formatCurrency(subtotal)}</strong>
            </div>
            <p className="mt-1 text-xs leading-5 text-taupe">Frete calculado no checkout.</p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase text-white transition hover:bg-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              Finalizar compra
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-ink transition hover:text-gold"
            >
              Continuar comprando
            </button>
          </div>
        ) : null
      }
    >
      {!isReady ? (
        <div className="grid min-h-64 place-items-center text-sm text-taupe">Carregando sua sacola...</div>
      ) : items.length === 0 ? (
        <div className="grid min-h-[55svh] place-items-center text-center">
          <div>
            <ShoppingBag className="mx-auto text-gold" size={38} strokeWidth={1.5} />
            <h3 className="mt-4 font-serif text-2xl font-semibold text-ink">Sua sacola está vazia</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-taupe">
              Encontre uma joia especial e acompanhe sua seleção por aqui.
            </p>
            <Link
              href="/produtos"
              onClick={onClose}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-ink px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              Ver produtos
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const alliance = isAlliance(item.product);
            const itemTotal = (item.product.price ?? 0) * item.quantity;

            return (
              <article key={item.lineId} className="rounded-lg border border-black/10 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-[80px_1fr] gap-3">
                  <Link
                    href={`/produtos/${item.product.slug}`}
                    onClick={onClose}
                    className="relative aspect-square overflow-hidden rounded-md bg-champagne"
                    aria-label={`Ver ${item.product.name}`}
                  >
                    <ProductImage
                      src={item.product.images?.[0]}
                      alt={item.product.name}
                      sizes="80px"
                      className="object-cover"
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/produtos/${item.product.slug}`}
                      onClick={onClose}
                      className="line-clamp-2 font-serif text-base font-semibold leading-5 text-ink transition hover:text-gold"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-xs text-taupe">{item.product.material}</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {item.product.price === null ? item.product.priceLabel : formatCurrency(item.product.price)}
                    </p>
                  </div>
                </div>

                {item.customization?.type === "ring_pair" ? (
                  <AllianceCustomization customization={item.customization} />
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/10 pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                      disabled={alliance || item.quantity <= 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Diminuir quantidade de ${item.product.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-ink" aria-label={`Quantidade: ${item.quantity}`}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                      disabled={alliance}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Aumentar quantidade de ${item.product.name}`}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.lineId)}
                      className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-taupe transition hover:bg-red-50 hover:text-red-700"
                      aria-label={`Remover ${item.product.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase tracking-[0.12em] text-taupe">Subtotal</span>
                    <strong className="text-sm text-ink">{formatCurrency(itemTotal)}</strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </OverlayDrawer>
  );
}
