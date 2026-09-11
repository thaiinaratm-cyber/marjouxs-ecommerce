"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProductById, isAlliance } from "@/lib/checkout/catalog";
import { hasValidPrice } from "@/lib/product-pricing";
import { newCartLine, parseStoredCart, serializeCart, CART_STORAGE_KEY } from "@/lib/cart-storage";
import { ringPairCustomizationSchema } from "@/lib/checkout/schemas";
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
      const product = getProductById(line.productId);
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

        if (isAlliance(product) && !ringPairCustomizationSchema.safeParse(customization).success) {
          return false;
        }

        const normalizedCustomization = isAlliance(product) ? customization : null;
        setLines((current) => {
          if (!isAlliance(product)) {
            const existing = current.find(
              (item) => item.productId === product.id && item.customization === null
            );

            if (existing) {
              return current.map((item) =>
                item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item
              );
            }
          }

          return [
            ...current,
            newCartLine(product.id, product.slug, 1, normalizedCustomization)
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
      updateQuantity(lineId, quantity) {
        setLines((current) =>
          current.map((line) => {
            if (line.lineId !== lineId) {
              return line;
            }

            const product = getProductById(line.productId);
            return {
              ...line,
              quantity: product && isAlliance(product) ? 1 : Math.max(1, Math.floor(quantity))
            };
          })
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
