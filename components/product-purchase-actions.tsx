"use client";

import { MessageCircle, PenLine, Ruler, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AnalyticsAnchor, AnalyticsLink } from "@/components/analytics-link";
import { ProductMobileCta } from "@/components/product-mobile-cta";
import { useCart } from "@/context/cart-context";
import { createSizeGuideClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { isAlliance } from "@/lib/checkout/catalog";
import { MAX_ENGRAVING_LENGTH } from "@/lib/checkout/limits";
import { formatCurrency } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import { getStoneOptions, STONE_REQUIRED } from "@/lib/stone-customization";
import type { CartCustomization, Product } from "@/types/product";

const ringSizes = Array.from({ length: 28 }, (_, index) => index + 8);
const actionClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold leading-tight text-white hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

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
  const canQuote = !canCheckout && product.allowWhatsappQuote;
  const canEngrave = alliance && product.engravingAvailable !== false;
  const engravingIncluded = product.engravingAvailable === true && product.engravingIncluded === true;
  const sizes = ringSizes.filter((size) => size >= (product.sizeMin ?? 8) && size <= (product.sizeMax ?? 35));
  const [ring1Size, setRing1Size] = useState("");
  const [ring2Size, setRing2Size] = useState("");
  const [ring1Engraving, setRing1Engraving] = useState("");
  const [ring2Engraving, setRing2Engraving] = useState("");
  const [stone, setStone] = useState("");
  const stoneOptions = getStoneOptions(product);
  const [message, setMessage] = useState("");
  const primaryCtaRef = useRef<HTMLDivElement>(null);

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCheckout) return;
    setMessage("");

    const selectedStone = stoneOptions.some(option => option.id === stone) ? stone : "";
    if (product.stoneCustomization && !selectedStone) {
      setMessage(STONE_REQUIRED);
      document.getElementById("product-stone-options")?.focus();
      return;
    }
    let customization: CartCustomization = selectedStone ? { type: "stone", stone_color: selectedStone } : null;
    if (alliance) {
      if (!ring1Size || !ring2Size) {
        setMessage("Selecione os dois aros para continuar.");
        return;
      }

      customization = {
        type: "ring_pair",
        ring1: { size: Number(ring1Size), engraving: canEngrave ? ring1Engraving.trim() || null : null },
        ring2: { size: Number(ring2Size), engraving: canEngrave ? ring2Engraving.trim() || null : null },
        ...(selectedStone ? { stone_color: selectedStone } : {})
      };
    }

    if (addItem(product, customization)) {
      router.push("/checkout");
      return;
    }

    setMessage("Não foi possível adicionar este produto à sacola.");
  }

  const whatsappEvents = createWhatsappClickEvent("product_page", product);
  if (!canCheckout && !canQuote) return null;

  return (
    <form data-pdp-actions data-pdp-inquiry={product.allowWhatsappQuote ? "" : undefined} onSubmit={addProduct} className="mt-6 grid gap-4">
      {alliance && canCheckout ? (
        <section className="rounded-lg border border-gold/25 bg-pearl p-4 sm:p-5" aria-labelledby="alliance-sizes-title">
          <h2 id="alliance-sizes-title" className="font-serif text-lg font-semibold text-ink">Escolha os dois aros</h2>
          {engravingIncluded || product.jewelryBoxIncluded === true ? (
            <p className="mt-1 text-sm text-taupe">
              {engravingIncluded && product.jewelryBoxIncluded === true ? "Gravação e caixinha inclusas."
                : engravingIncluded ? "Gravação inclusa." : "Caixinha inclusa."}
            </p>
          ) : null}
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
                <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">
                  Aro
                  <select
                    required
                    value={ring.size}
                    onChange={(event) => ring.setSize(event.target.value)}
                    className="h-11 w-full min-w-0 scroll-mt-40 rounded-md border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
                  >
                    <option value="">Selecione</option>
                    {sizes.map((size) => (
                      <option key={size} value={size}>Aro {size}</option>
                    ))}
                  </select>
                </label>
                {canEngrave ? <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">
                  Gravação opcional
                  <input
                    value={ring.engraving}
                    maxLength={MAX_ENGRAVING_LENGTH}
                    onChange={(event) => ring.setEngraving(event.target.value)}
                    className="h-11 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-base outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/25"
                    placeholder="Nome, data ou símbolo"
                  />
                </label> : null}
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
        </section>
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
                {canEngrave ? <p className="mt-0.5 break-words text-sm leading-5 text-taupe">
                  Gravação: {ring.engraving.trim() || "Sem gravação"}
                </p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {canCheckout ? (
        product.stoneCustomization ? (
          <fieldset id="product-stone-options" tabIndex={-1} aria-describedby={message === STONE_REQUIRED ? "product-stone-error" : undefined} className="min-w-0 scroll-mt-40">
            <legend className="mb-2 text-sm font-semibold text-ink">Escolha a cor da pedra</legend>
            <div className="flex flex-wrap gap-2">
              {stoneOptions.map(option => (
                <label key={option.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-black/15 px-3 text-sm text-ink has-[:checked]:border-gold has-[:checked]:bg-pearl has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold">
                  <input className="sr-only" type="radio" name="stoneColor" value={option.id} checked={stone === option.id}
                    onChange={() => { setStone(option.id); setMessage(""); }} />
                  <span className="size-4 shrink-0 rounded-full border border-black/25" aria-hidden="true" style={{ backgroundColor: option.color }} />
                  {option.name}
                </label>
              ))}
            </div>
            {message === STONE_REQUIRED ? <p id="product-stone-error" className="mt-2 text-sm text-red-700" role="alert">{message}</p> : null}
            {!stoneOptions.length ? <p className="text-sm text-taupe">Nenhuma cor disponível no momento.</p> : null}
          </fieldset>
        ) : null
      ) : null}

      <div ref={primaryCtaRef}>
        {canCheckout ? (
          <button type="submit" className={`${actionClass} w-full`}>
            <ShoppingBag aria-hidden="true" size={18} /> Comprar agora
          </button>
        ) : (
          <AnalyticsAnchor href={whatsappUrl} analyticsEvents={whatsappEvents} target="_blank" rel="noopener noreferrer"
            className={`${actionClass} w-full`}>
            <MessageCircle aria-hidden="true" size={18} /> Solicitar orçamento no WhatsApp
          </AnalyticsAnchor>
        )}
      </div>

      {message && message !== STONE_REQUIRED ? (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}

      {canCheckout && product.allowWhatsappQuote ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-taupe">
          <MessageCircle aria-hidden="true" className="mt-0.5 shrink-0 text-gold" size={15} />
          <span>
            {alliance
              ? "Deseja comprar somente uma aliança ou precisa de ajuda? "
              : "Precisa de ajuda? "}
            <AnalyticsAnchor
              href={whatsappUrl}
              analyticsEvents={whatsappEvents}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold"
            >
              Falar com a Marjouxs
            </AnalyticsAnchor>
          </span>
        </p>
      ) : null}

      <ProductMobileCta primary={primaryCtaRef} label={canCheckout && product.price !== null ? formatCurrency(product.price) : "Sob consulta"}>
        {canCheckout ? (
          <button type="submit" className={`${actionClass} min-w-0 flex-[1_1_8rem]`}>
            <ShoppingBag aria-hidden="true" className="shrink-0" size={17} /> Comprar agora
          </button>
        ) : (
          <AnalyticsAnchor href={whatsappUrl} analyticsEvents={whatsappEvents} target="_blank" rel="noopener noreferrer"
            className={`${actionClass} min-w-0 flex-[1_1_8rem]`}>
            <MessageCircle aria-hidden="true" className="shrink-0" size={17} /> Falar no WhatsApp
          </AnalyticsAnchor>
        )}
      </ProductMobileCta>
    </form>
  );
}
