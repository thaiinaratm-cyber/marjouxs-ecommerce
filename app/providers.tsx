"use client";

import { CartProvider } from "@/context/cart-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
