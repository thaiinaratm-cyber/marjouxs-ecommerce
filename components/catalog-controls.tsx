"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { OverlayDrawer } from "@/components/overlay-drawer";
import { trackSearch } from "@/lib/analytics";
import { catalogHref, priceKinds, type DiscoveryOptions, type DiscoveryQuery } from "@/lib/catalog/discovery";
import { productPriceRanges, readSearchTerm, type ProductFilterOption } from "@/lib/product-discovery";

const fieldClass = "min-h-11 w-full min-w-0 rounded-md border border-black/15 bg-white px-2.5 text-sm font-normal text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

function SelectField({ name, label, options, emptyLabel = "Todos", ...selection }: {
  name: string; label: string; options: ProductFilterOption[]; emptyLabel?: string;
  value?: string; defaultValue?: string; onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="grid min-w-0 content-start gap-1 text-sm font-medium text-ink">
      {label}
      <select className={fieldClass} name={name} {...selection}>
        <option value="">{emptyLabel}</option>
        {options.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
  );
}

function FilterFields({ options, query }: { options: DiscoveryOptions; query: DiscoveryQuery }) {
  const [category, setCategory] = useState(query.categoria ?? "");
  const [subcategory, setSubcategory] = useState(query.subcategoria ?? "");
  const subcategories = options.subcategories[category] ?? [];
  return (
    <>
      {options.categories.length > 0 ? (
        <SelectField name="categoria" label="Categoria" options={options.categories} value={category} onChange={(event) => {
          const next = event.target.value;
          setCategory(next);
          if (!options.subcategories[next]?.some(({ value }) => value === subcategory)) setSubcategory("");
        }} />
      ) : null}
      {subcategories.length > 0 ? (
        <SelectField name="subcategoria" label="Subcategoria" options={subcategories}
          value={subcategory} onChange={(event) => setSubcategory(event.target.value)} />
      ) : null}
      {options.materials.length > 1 || query.material ? (
        <SelectField name="material" label="Material" options={options.materials} defaultValue={query.material} />
      ) : null}
      <SelectField name="preco" label="Faixa de preço" options={productPriceRanges} emptyLabel="Todas" defaultValue={query.preco} />
      <div className="grid min-w-0 grid-cols-2 gap-2 lg:col-span-2">
        <label className="grid min-w-0 gap-1 text-sm font-medium text-ink">
          Preço mín. (R$)
          <input name="min_price" inputMode="decimal" pattern="[0-9]{1,9}([.,][0-9]{1,2})?" maxLength={12} defaultValue={query.min_price} className={fieldClass} />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-ink">
          Preço máx. (R$)
          <input name="max_price" inputMode="decimal" pattern="[0-9]{1,9}([.,][0-9]{1,2})?" maxLength={12} defaultValue={query.max_price} className={fieldClass} />
        </label>
      </div>
      <SelectField name="tipo_preco" label="Tipo de preço" options={priceKinds} defaultValue={query.tipo_preco} />
      {options.availability.length > 1 || query.disponibilidade ? (
        <SelectField name="disponibilidade" label="Disponibilidade" options={options.availability} emptyLabel="Todas" defaultValue={query.disponibilidade} />
      ) : null}
      <SelectField name="ordem" label="Ordenar por" emptyLabel="Relevância" options={[
        { value: "menor-preco", label: "Menor preço" },
        { value: "maior-preco", label: "Maior preço" },
        { value: "nome-az", label: "Nome A–Z" },
        { value: "destaques", label: "Destaques" }
      ]} defaultValue={query.ordem === "relevantes" ? "" : query.ordem} />
      {options.hasCustomizableStone || query.pedra ? (
        <label className="flex min-h-11 min-w-0 items-center gap-2 text-sm font-medium text-ink lg:col-span-2">
          <input name="pedra" type="checkbox" value="1" defaultChecked={query.pedra === "1"}
            className="h-4 w-4 shrink-0 accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" />
          Pedra personalizável
        </label>
      ) : null}
    </>
  );
}

export function CatalogControls({ pathname, options, query, filterCount, source }: {
  pathname: string; options: DiscoveryOptions; query: DiscoveryQuery; filterCount: number; source: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function navigate(event: FormEvent<HTMLFormElement>, searching: boolean) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as DiscoveryQuery;
    const term = readSearchTerm(data.busca);
    const next = searching ? { ...query, busca: term, pagina: undefined } : { ...data, busca: query.busca };
    if (searching && term.length >= 2 && term !== query.busca) trackSearch(term, source);
    setOpen(false);
    startTransition(() => router.push(catalogHref(pathname, next), { scroll: false }));
  }
  return (
    <div aria-busy={isPending} className="grid min-w-0 gap-3 border-y border-black/10 py-3">
      <div className="flex min-w-0 flex-wrap gap-2">
        <form role="search" aria-label="Busca no catálogo" action={pathname} onSubmit={(event) => navigate(event, true)} className="flex min-w-0 flex-[1_1_12rem] gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Buscar no catálogo</span>
            <input type="search" name="busca" defaultValue={query.busca} maxLength={120} className={fieldClass} placeholder="Buscar no catálogo" />
          </label>
          <button type="submit" className={buttonClass} aria-label="Buscar no catálogo" disabled={isPending}>
            <Search aria-hidden="true" size={18} />
          </button>
        </form>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" disabled={isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-black/20 bg-white px-3 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:hidden">
          <SlidersHorizontal aria-hidden="true" size={17} /> Filtros{filterCount ? ` (${filterCount})` : ""}
        </button>
      </div>
      <form aria-label="Filtros do catálogo" action={pathname} onSubmit={(event) => navigate(event, false)}
        className="hidden min-w-0 grid-cols-5 items-end gap-3 lg:grid xl:grid-cols-6">
        <FilterFields options={options} query={query} />
        <button type="submit" className={buttonClass} disabled={isPending}>Aplicar filtros</button>
      </form>
      <OverlayDrawer open={open} onClose={() => setOpen(false)} title="Filtros">
        {open ? (
          <form aria-label="Filtros do catálogo" action={pathname} onSubmit={(event) => navigate(event, false)} className="grid min-w-0 gap-4">
            <FilterFields options={options} query={query} />
            <button type="submit" className={buttonClass} disabled={isPending}>Aplicar filtros</button>
          </form>
        ) : null}
      </OverlayDrawer>
    </div>
  );
}
