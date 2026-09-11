"use client";

import Link from "next/link";
import { Check, MessageCircle, Ruler, ShoppingBag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AnalyticsAnchor, AnalyticsLink } from "@/components/analytics-link";
import { useCart } from "@/context/cart-context";
import { createSizeGuideClickEvent, createWhatsappClickEvent } from "@/lib/analytics";
import { isAlliance } from "@/lib/checkout/catalog";
import { hasValidPrice } from "@/lib/product-pricing";
import type { Product, RingPairCustomization } from "@/types/product";

const RING_SIZES = Array.from({ length: 28 }, (_, index) => index + 8);

function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} fill="currentColor">
      <path d="M16.01 3.2A12.66 12.66 0 0 0 5.22 22.5L3.6 28.8l6.45-1.56A12.67 12.67 0 1 0 16.01 3.2Zm0 22.98c-1.97 0-3.9-.56-5.56-1.62l-.4-.25-3.83.93.97-3.73-.26-.39a10.24 10.24 0 1 1 9.08 5.06Zm5.83-7.66c-.32-.16-1.9-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.15.32-.38.48-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.12 1.32 3.33c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.48.21 2.04.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function ProductPurchaseActions({
  product,
  whatsappUrl
}: {
  product: Product;
  whatsappUrl: string;
}) {
  const { addItem } = useCart();
  const alliance = isAlliance(product);
  const canCheckout = hasValidPrice(product);
  const [ring1Size, setRing1Size] = useState("");
  const [ring2Size, setRing2Size] = useState("");
  const [ring1Engraving, setRing1Engraving] = useState("");
  const [ring2Engraving, setRing2Engraving] = useState("");
  const [message, setMessage] = useState("");

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let customization: RingPairCustomization | null = null;
    if (alliance) {
      if (!ring1Size || !ring2Size) {
        setMessage("Selecione os dois aros para adicionar o par.");
        return;
      }

      customization = {
        type: "ring_pair",
        ring1: { size: Number(ring1Size), engraving: ring1Engraving || null },
        ring2: { size: Number(ring2Size), engraving: ring2Engraving || null }
      };
    }

    if (addItem(product, customization)) {
      setMessage(alliance ? "Par configurado e adicionado à sacola." : "Produto adicionado à sacola.");
    }
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

      <div className={`grid gap-3 ${canCheckout ? "sm:grid-cols-2" : ""}`}>
        {product.allowWhatsappQuote ? (
          <AnalyticsAnchor
            href={whatsappUrl}
            analyticsEvents={createWhatsappClickEvent("product_page", product)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 transition hover:bg-[#1ebe5d] hover:shadow-soft"
          >
            <WhatsappIcon size={18} /> Comprar pelo WhatsApp
          </AnalyticsAnchor>
        ) : null}
        {canCheckout ? (
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            <ShoppingBag size={18} /> {alliance ? "Adicionar par à sacola" : "Adicionar à sacola"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`flex items-center gap-2 text-sm ${message.startsWith("Selecione") ? "text-red-700" : "text-ink"}`} role="status">
          {!message.startsWith("Selecione") ? <Check className="text-gold" size={17} /> : null}
          <span>{message}</span>
          {!message.startsWith("Selecione") ? <Link href="/carrinho" className="font-semibold underline decoration-gold underline-offset-4">Ver sacola</Link> : null}
        </p>
      ) : null}

      {alliance ? (
        <p className="text-xs leading-5 text-taupe">
          Deseja comprar somente uma aliança? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-gold">Fale com nossa equipe pelo WhatsApp.</a>
        </p>
      ) : null}
    </form>
  );
}
