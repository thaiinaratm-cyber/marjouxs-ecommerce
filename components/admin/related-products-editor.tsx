"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { searchRelatedProductsAction } from "@/app/admin/(protected)/produtos/relation-actions";
import type { RelationOption } from "@/lib/admin/product-relations";
import { MAX_MANUAL_RELATIONS } from "@/lib/product-recommendations";

const iconButton = "grid size-10 shrink-0 place-items-center rounded border border-black/15 hover:border-gold focus-visible:outline-gold disabled:opacity-30";

export function RelatedProductsEditor({ initial = [], productId }: { initial?: RelationOption[]; productId?: string }) {
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<{ query: string; items: RelationOption[] | null } | null>(null);
  const text = query.trim();
  const options = response?.query === text ? response.items : undefined;
  const atLimit = selected.length >= MAX_MANUAL_RELATIONS;
  useEffect(() => {
    if (text.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      void searchRelatedProductsAction(text, productId)
        .then(items => { if (active) setResponse({ query: text, items }); })
        .catch(() => { if (active) setResponse({ query: text, items: null }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [text, productId]);

  function move(index: number, change: number) {
    setSelected(previous => {
      const target = index + change;
      if (target < 0 || target >= previous.length) return previous;
      const copy = [...previous];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  return <fieldset className="min-w-0">
    <legend className="font-serif text-xl font-semibold text-ink">Produtos relacionados</legend>
    <p className="mt-1 text-sm text-taupe">{selected.length} de {MAX_MANUAL_RELATIONS}</p>
    <label className="mt-4 grid gap-1 text-sm font-semibold">
      Buscar por nome ou slug
      <span className="relative block">
        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-taupe" />
        <input type="search" value={query} maxLength={80} onChange={event => setQuery(event.target.value)}
          className="h-11 w-full min-w-0 rounded border border-black/20 bg-white pl-9 pr-3 font-normal focus-visible:outline-gold" />
      </span>
    </label>
    {text.length >= 2 ? <div className="mt-2">
      {options?.length ? <ul aria-label="Resultados da busca" className="max-h-60 overflow-y-auto rounded border border-black/10">
        {options.map(option => {
          const added = selected.some(item => item.id === option.id);
          return <li key={option.id} className="flex items-center justify-between gap-2 border-b border-black/10 p-2 last:border-b-0">
            <div className="min-w-0 text-sm [overflow-wrap:anywhere]"><p className="font-semibold">{option.name}</p>
              <p className="text-xs text-taupe">{option.slug}</p></div>
            <button type="button" aria-label={`Adicionar ${option.name}`} disabled={added || atLimit} className={iconButton}
              onClick={() => setSelected(previous => previous.length < MAX_MANUAL_RELATIONS &&
                previous.every(item => item.id !== option.id) ? [...previous, option] : previous)}>
              <Plus size={16} aria-hidden="true" />
            </button>
          </li>;
        })}
      </ul> : <p role="status" className="py-2 text-sm text-taupe">{options === undefined ? "Buscando…" :
        options === null ? "Busca indisponível." : "Nenhum produto encontrado."}</p>}
    </div> : null}
    {selected.length ? <ol aria-label="Produtos selecionados" className="mt-4 divide-y divide-black/10 border-y border-black/10">
      {selected.map((option, index) => <li key={option.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
        <input name="relatedProductIds" type="hidden" value={option.id} />
        <span className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">{index + 1}. {option.name}
          {!option.available ? <span className="block text-xs font-normal text-taupe">Indisponível</span> : null}</span>
        <div className="flex shrink-0 gap-1">
          <button type="button" className={iconButton} aria-label={`Subir ${option.name}`} disabled={index === 0}
            onClick={() => move(index, -1)}><ArrowUp size={16} aria-hidden="true" /></button>
          <button type="button" className={iconButton} aria-label={`Descer ${option.name}`} disabled={index === selected.length - 1}
            onClick={() => move(index, 1)}><ArrowDown size={16} aria-hidden="true" /></button>
          <button type="button" className={iconButton} aria-label={`Remover ${option.name}`}
            onClick={() => setSelected(previous => previous.filter(item => item.id !== option.id))}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </li>)}
    </ol> : null}
  </fieldset>;
}
