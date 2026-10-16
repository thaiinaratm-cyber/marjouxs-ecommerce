"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProductFields, type AdminProductFieldValues } from "@/components/admin/product-fields";
import type { AdminTaxonomy } from "@/lib/admin/catalog";
import type { AdminProductFormState } from "@/lib/admin/product-form";

export function ProductForm({ action, taxonomy, values, children, submitLabel }: {
  action: (data: FormData) => Promise<AdminProductFormState>;
  taxonomy: AdminTaxonomy;
  values?: AdminProductFieldValues;
  children?: ReactNode;
  submitLabel: string;
}) {
  const [state, setState] = useState<AdminProductFormState>({});
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const fields = form.current?.elements;
    if (!fields) return;
    for (const element of Array.from(fields)) {
      if (element instanceof HTMLElement && element.getAttribute("name")) {
        const name = element.getAttribute("name")!;
        const invalid = Boolean(state.fieldErrors?.[name]);
        element.setAttribute("aria-invalid", String(invalid));
        if (invalid) element.setAttribute("aria-describedby", `error-${name}`);
        else element.removeAttribute("aria-describedby");
      }
    }
    const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (first) {
      first.focus({ preventScroll: true });
      first.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  }, [state]);

  return <form ref={form} noValidate onSubmit={async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await action(data);
      if (result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      } else setState(result);
    } finally { setPending(false); }
  }} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7 [&_[aria-invalid=true]]:border-red-500 [&_[aria-invalid=true]]:ring-red-100">
    {children}
    {state.message ? <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</div> : null}
    <ProductFields taxonomy={taxonomy} values={values} fieldErrors={state.fieldErrors} />
    <div className="mt-7 flex justify-end"><button disabled={pending} type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-gold disabled:opacity-60">
      <Save size={17} aria-hidden="true" />{pending ? "Salvando…" : submitLabel}
    </button></div>
  </form>;
}
