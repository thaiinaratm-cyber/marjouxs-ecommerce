"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";

export default function CartPage() {
  const { items, subtotal, totalItems, removeItem, updateQuantity } = useCart();
  const hasQuoteItems = items.some((item) => item.product.price === null);

  if (items.length === 0) {
    return (
      <section className="mx-auto grid min-h-[55svh] max-w-3xl place-items-center px-4 py-12 text-center sm:px-6 lg:px-8">
        <div>
          <ShoppingBag className="mx-auto text-gold" size={42} />
          <h1 className="mt-4 font-serif text-4xl font-semibold text-ink">Seu carrinho esta vazio</h1>
          <p className="mt-3 text-taupe">Adicione joias, servicos ou solicite orcamento pelo WhatsApp.</p>
          <Link
            href="/produtos"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            Ver produtos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Carrinho</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Revise seu pedido</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {items.map((item) => (
            <article key={item.product.id} className="grid gap-4 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:grid-cols-[120px_1fr]">
              <div className="relative aspect-square overflow-hidden rounded-md bg-champagne">
                <ProductImage src={item.product.images?.[0]} alt={item.product.name} sizes="120px" className="object-cover" />
              </div>
              <div className="grid gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold">{item.product.category}</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">{item.product.name}</h2>
                  <p className="mt-1 text-sm text-taupe">Preco unitario: {item.product.priceLabel}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="min-w-10 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-taupe hover:text-red-600"
                      aria-label="Remover item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="rounded-md bg-pearl px-4 py-3 text-sm sm:text-right">
                    <span className="block text-taupe">Total do item</span>
                    <strong className="text-base text-ink">
                      {item.product.price === null ? item.product.priceLabel : formatCurrency(item.product.price * item.quantity)}
                    </strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-ink">Resumo</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-taupe">Itens</span>
              <span className="font-semibold text-ink">{totalItems}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-black/10 pt-3">
              <span className="text-taupe">Total</span>
              <span className="font-semibold text-ink">{formatCurrency(subtotal)}</span>
            </div>
          </div>
          {hasQuoteItems && (
            <p className="mt-4 text-xs leading-5 text-taupe">
              Itens sob orcamento serao confirmados pela equipe antes da finalizacao.
            </p>
          )}
          <Link
            href="/checkout"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            Ir para checkout
          </Link>
          <Link
            href="/produtos"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold"
          >
            Continuar comprando
          </Link>
        </aside>
      </div>
    </section>
  );
}
