"use client";

import { MessageCircle, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { hasValidPrice } from "@/lib/product-pricing";
import { buildQuoteUrl } from "@/lib/whatsapp";
import type { Product } from "@/types/product";

export function AddToCartButton({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addItem } = useCart();
  const [wasAdded, setWasAdded] = useState(false);

  if (!hasValidPrice(product)) {
    return (
      <a
        href={buildQuoteUrl(product)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold"
      >
        <MessageCircle size={18} />
        {compact ? "Orçamento" : "Solicitar orçamento"}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        addItem(product);
        setWasAdded(true);
        window.setTimeout(() => setWasAdded(false), 1600);
      }}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold"
    >
      <ShoppingBag size={18} />
      {wasAdded ? "Adicionado" : compact ? "Comprar" : "Adicionar ao carrinho"}
    </button>
  );
}
