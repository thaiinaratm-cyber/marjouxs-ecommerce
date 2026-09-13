"use client";

import { MessageCircle, PenLine, Ruler, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnalyticsAnchor, AnalyticsLink } from "@/components/analytics-link";
import { useCart } from "@/context/cart-context";
import { createSizeGuideClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { isAlliance } from "@/lib/checkout/catalog";
import { formatCurrency } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import type { Product, RingPairCustomization } from "@/types/product";

const RING_SIZES = Array.from({ length: 28 }, (_, index) => index + 8);

export function ProductPurchaseActions({
  product,
  whatsappUrl
}: {
  product: Product;
  whatsappUrl: string;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const alliance = isAlliance(product);
  const canCheckout = hasValidPrice(product);
  const [ring1Size, setRing1Size] = useState("");
  const [ring2Size, setRing2Size] = useState("");
  const [ring1Engraving, setRing1Engraving] = useState("");
  const [ring2Engraving, setRing2Engraving] = useState("");
  const [message, setMessage] = useState("");
  const [showMobileCta, setShowMobileCta] = useState(false);
  const primaryCtaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const primaryCta = primaryCtaRef.current;

    if (!primaryCta || !canCheckout) {
      return;
    }

    let animationFrame = 0;

    const updateMobileCta = () => {
      if (animationFrame) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        const isMobile = window.matchMedia("(max-width: 1023px)").matches;
        const hasPassedPrimaryCta = primaryCta.getBoundingClientRect().bottom <= 0;
        setShowMobileCta(isMobile && hasPassedPrimaryCta);
        animationFrame = 0;
      });
    };

    updateMobileCta();
    window.addEventListener("scroll", updateMobileCta, { passive: true });
    window.addEventListener("resize", updateMobileCta);

    return () => {
      window.removeEventListener("scroll", updateMobileCta);
      window.removeEventListener("resize", updateMobileCta);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [canCheckout]);

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    let customization: RingPairCustomization | null = null;
    if (alliance) {
      if (!ring1Size || !ring2Size) {
        setMessage("Selecione os dois aros para continuar.");
        return;
      }

      customization = {
        type: "ring_pair",
        ring1: { size: Number(ring1Size), engraving: ring1Engraving.trim() || null },
        ring2: { size: Number(ring2Size), engraving: ring2Engraving.trim() || null }
      };
    }

    if (addItem(product, customization)) {
      router.push("/checkout");
      return;
    }

    setMessage("Não foi possível adicionar este produto à sacola.");
  }

  return (
    <form onSubmit={addProduct} className="mt-6 grid gap-4">
      {alliance && canCheckout ? (
        <div className="rounded-lg border border-gold/25 bg-pearl p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Escolha as numerações</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              {
                label: "Aliança 1",
                size: ring1Size,
                engraving: ring1Engraving,
                setSize: setRing1Size,
                setEngraving: setRing1Engraving
              },
              {
                label: "Aliança 2",
                size: ring2Size,
                engraving: ring2Engraving,
                setSize: setRing2Size,
                setEngraving: setRing2Engraving
              }
            ].map((ring) => (
              <fieldset key={ring.label} className="grid gap-3">
                <legend className="font-serif text-lg font-semibold text-ink">{ring.label}</legend>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Aro
                  <select
                    required
                    value={ring.size}
                    onChange={(event) => ring.setSize(event.target.value)}
                    className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/15"
                  >
                    <option value="">Selecione</option>
                    {RING_SIZES.map((size) => (
                      <option key={size} value={size}>Aro {size}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Gravação opcional
                  <input
                    value={ring.engraving}
                    onChange={(event) => ring.setEngraving(event.target.value)}
                    className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
                    placeholder="Nome, data ou símbolo"
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <AnalyticsLink
            href="/guia-de-tamanhos"
            analyticsEvents={createSizeGuideClickEvent("alliance_configurator", product)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-gold"
          >
            <Ruler size={17} /> Ver Guia de Tamanhos
          </AnalyticsLink>
        </div>
      ) : null}

      {alliance && canCheckout ? (
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm" aria-labelledby="alliance-summary-title">
          <p id="alliance-summary-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <PenLine aria-hidden="true" size={16} strokeWidth={1.7} /> Sua configuração
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Aliança 1", size: ring1Size, engraving: ring1Engraving },
              { label: "Aliança 2", size: ring2Size, engraving: ring2Engraving }
            ].map((ring) => (
              <div key={ring.label} className="rounded-md border border-black/10 bg-pearl px-3 py-3">
                <p className="font-serif text-base font-semibold text-ink">{ring.label}</p>
                <p className="mt-1 text-sm text-ink">
                  {ring.size ? `Aro: ${ring.size}` : "Selecione o aro"}
                </p>
                <p className="mt-0.5 break-words text-sm leading-5 text-taupe">
                  Gravação: {ring.engraving.trim() || "Sem gravação"}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {canCheckout ? (
        <button
          ref={primaryCtaRef}
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold"
        >
          <ShoppingBag size={18} /> COMPRAR AGORA
        </button>
      ) : null}

      {message ? (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}

      {product.allowWhatsappQuote ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-taupe">
          <MessageCircle className="mt-0.5 shrink-0 text-gold" size={15} />
          <span>
            {alliance
              ? "Deseja comprar somente uma aliança ou precisa de ajuda? "
              : "Precisa de ajuda? "}
            <AnalyticsAnchor
              href={whatsappUrl}
              analyticsEvents={createWhatsappClickEvent("product_page", product)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink transition hover:text-gold"
            >
              Fale com nossa equipe pelo WhatsApp.
            </AnalyticsAnchor>
          </span>
        </p>
      ) : null}

      {showMobileCta && canCheckout && product.price ? (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-white/95 shadow-[0_-8px_24px_rgba(29,27,25,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <div className="min-w-0 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-taupe">Preço</p>
              <p className="whitespace-nowrap text-base font-semibold text-ink">{formatCurrency(product.price)}</p>
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-xs font-semibold text-white shadow-sm transition active:bg-gold"
            >
              <ShoppingBag aria-hidden="true" size={17} /> COMPRAR AGORA
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
