"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProductById, isAlliance } from "@/lib/checkout/catalog";
import { hasValidPrice } from "@/lib/product-pricing";
import { newCartLine, parseStoredCart, serializeCart, CART_STORAGE_KEY } from "@/lib/cart-storage";
import { cartCustomizationSchema } from "@/lib/checkout/schemas";
import { acceptsStone, getStoneOptions } from "@/lib/stone-customization";
import { trackAddToCart, trackRemoveFromCart } from "@/lib/analytics";
import type { CartCustomization, CartItem, CartLine, Product } from "@/types/product";

type CartContextValue = {
  items: CartItem[];
  lines: CartLine[];
  totalItems: number;
  subtotal: number;
  isReady: boolean;
  addItem: (product: Product, customization?: CartCustomization) => boolean;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateStoneColor: (lineId: string, stone: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setLines(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY)));
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) {
      window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
    }
  }, [lines, isReady]);

  const value = useMemo<CartContextValue>(() => {
    const items = lines.flatMap<CartItem>((line) => {
      const product = line.productSnapshot ?? getProductById(line.productId);
      return product ? [{ ...line, product }] : [];
    });
    const totalItems = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + (item.product.price ?? 0) * item.quantity, 0);

    return {
      items,
      lines,
      totalItems,
      subtotal,
      isReady,
      addItem(product, customization = null) {
        if (!hasValidPrice(product)) {
          return false;
        }

        const parsed = cartCustomizationSchema.safeParse(customization);
        if (!parsed.success || (parsed.data?.type === "ring_pair") !== isAlliance(product) ||
            !acceptsStone(product, parsed.data)) {
          return false;
        }

        const normalizedCustomization = parsed.data;
        setLines((current) => {
          if (!isAlliance(product)) {
            const existing = current.find(
              (item) => item.productId === product.id &&
                item.customization?.stone_color === normalizedCustomization?.stone_color
            );

            if (existing) {
              return current.map((item) =>
                item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1, productSnapshot: product } : item
              );
            }
          }

          return [
            ...current,
            newCartLine(product.id, product.slug, 1, normalizedCustomization, product)
          ];
        });
        trackAddToCart(product, 1);
        return true;
      },
      removeItem(lineId) {
        const item = items.find((candidate) => candidate.lineId === lineId);
        if (item) {
          trackRemoveFromCart(item.product, item.quantity);
        }
        setLines((current) => current.filter((item) => item.lineId !== lineId));
      },
      updateStoneColor(lineId, stone) {
        const item = items.find(candidate => candidate.lineId === lineId);
        if (!item || !getStoneOptions(item.product).some(option => option.id === stone) ||
            (isAlliance(item.product) && item.customization?.type !== "ring_pair")) return;
        const customization: CartCustomization = item.customization?.type === "ring_pair"
          ? { ...item.customization, stone_color: stone }
          : { type: "stone", stone_color: stone };
        setLines(current => current.map(line => line.lineId === lineId ? { ...line, customization } : line));
      },
      updateQuantity(lineId, quantity) {
        const item = items.find((candidate) => candidate.lineId === lineId);
        if (!item) return;

        const nextQuantity = isAlliance(item.product) ? 1 : Math.max(1, Math.floor(quantity));
        if (nextQuantity === item.quantity) return;

        const quantityDifference = Math.abs(nextQuantity - item.quantity);
        if (nextQuantity > item.quantity) {
          trackAddToCart(item.product, quantityDifference);
        } else {
          trackRemoveFromCart(item.product, quantityDifference);
        }

        setLines((current) =>
          current.map((line) => line.lineId === lineId ? { ...line, quantity: nextQuantity } : line)
        );
      },
      clearCart() {
        setLines([]);
      }
    };
  }, [lines, isReady]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
