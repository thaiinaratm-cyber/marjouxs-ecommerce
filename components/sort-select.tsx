"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProductSortOrder } from "@/lib/product-sorting";

export function SortSelect({ value }: { value: ProductSortOrder }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextValue: ProductSortOrder) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValue === "relevantes") {
      params.delete("ordem");
    } else {
      params.set("ordem", nextValue);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex w-full items-center gap-3 sm:w-auto">
      <span className="whitespace-nowrap text-sm font-medium text-taupe">Ordenar por</span>
      <select
        value={value}
        onChange={(event) => handleChange(event.target.value as ProductSortOrder)}
        className="h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm font-medium text-ink outline-none transition focus:border-gold sm:w-44"
      >
        <option value="relevantes">Mais relevantes</option>
        <option value="menor-preco">Menor preço</option>
        <option value="maior-preco">Maior preço</option>
      </select>
    </label>
  );
}
