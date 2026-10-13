"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export function ProductSearchInput({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value === initialValue) return;
    const timer = window.setTimeout(() => input.current?.form?.requestSubmit(), 350);
    return () => window.clearTimeout(timer);
  }, [value, initialValue]);

  return (
    <label className="relative block min-w-0 sm:col-span-2">
      <span className="sr-only">Pesquisar produto</span>
      <Search size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-gold" />
      <input ref={input} name="q" value={value} onChange={(event) => setValue(event.target.value)}
        placeholder="Pesquisar produto" maxLength={80}
        className="h-11 w-full rounded border border-black/15 pl-9 pr-2 text-sm text-ink" />
    </label>
  );
}
