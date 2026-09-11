"use client";

import { useEffect, useRef } from "react";
import { trackViewCategory, trackViewItem } from "@/lib/analytics";
import type { Product } from "@/types/product";

export function ProductViewTracker({ product }: { product: Product }) {
  const lastTrackedProductId = useRef<string | null>(null);

  useEffect(() => {
    if (lastTrackedProductId.current === product.id) {
      return;
    }

    lastTrackedProductId.current = product.id;
    trackViewItem(product);
  }, [product]);

  return null;
}

export function CategoryViewTracker({
  categoryName,
  source = "category_page"
}: {
  categoryName: string;
  source?: string;
}) {
  const lastTrackedCategory = useRef<string | null>(null);

  useEffect(() => {
    if (lastTrackedCategory.current === categoryName) {
      return;
    }

    lastTrackedCategory.current = categoryName;
    trackViewCategory(categoryName, source);
  }, [categoryName, source]);

  return null;
}
