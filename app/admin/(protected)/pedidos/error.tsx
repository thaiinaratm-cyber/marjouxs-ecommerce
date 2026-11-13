"use client";
import { RefreshCw } from "lucide-react";
export default function OrdersError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><h1 className="font-serif text-2xl font-semibold text-ink">Não foi possível carregar os pedidos</h1><p className="mt-3 text-sm text-taupe">Tente novamente em alguns instantes.</p><button onClick={reset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded bg-ink px-4 text-sm font-semibold text-white"><RefreshCw size={16} />Tentar novamente</button></div>;
}
