"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import {
  moveProductImageAction,
  removeProductImageAction,
  setPrimaryImageAction,
  updateProductImageAltAction
} from "@/app/admin/(protected)/produtos/image-actions";

type ManagedImage = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
};

export function ProductImageManager({ productId, images }: { productId: string; images: ManagedImage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setStatus(null);
    startTransition(async () => {
      const result = await action();
      setStatus(result.ok ? "Imagens atualizadas." : result.error ?? "Não foi possível atualizar as imagens.");
      if (result.ok) router.refresh();
    });
  }

  if (!images.length) return null;
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5">
      <h2 className="font-serif text-xl font-semibold text-ink">Imagens</h2>
      <div className="mt-4 grid gap-4">
        {images.map((image, index) => (
          <div key={image.id} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-md border border-black/10 p-2">
            <div className="relative aspect-square overflow-hidden rounded bg-pearl">
              <Image src={image.url} alt={image.altText ?? "Imagem do produto"} fill sizes="76px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">{image.isPrimary ? "Principal" : `Imagem ${index + 1}`}</p>
              <form className="mt-2 flex gap-1" onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                run(() => updateProductImageAltAction(productId, image.id, String(data.get("altText") ?? "")));
              }}>
                <input name="altText" key={`${image.id}-${image.altText}`} defaultValue={image.altText ?? ""} maxLength={180}
                  aria-label="Texto alternativo da imagem" className="h-9 min-w-0 flex-1 rounded border border-black/15 px-2 text-xs" />
                <button disabled={pending} className="rounded border border-black/15 px-2 text-xs font-semibold hover:border-gold">Salvar</button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1">
                {!image.isPrimary ? <button type="button" disabled={pending} onClick={() => run(() => setPrimaryImageAction(productId, image.id))}
                  title="Definir como principal" aria-label="Definir como principal" className="rounded border border-black/15 p-2 text-gold hover:border-gold"><Star size={15} /></button> : null}
                <button type="button" disabled={pending || index === 0} onClick={() => run(() => moveProductImageAction(productId, image.id, "up"))}
                  title="Mover para cima" aria-label="Mover para cima" className="rounded border border-black/15 p-2 hover:border-gold"><ArrowUp size={15} /></button>
                <button type="button" disabled={pending || index === images.length - 1} onClick={() => run(() => moveProductImageAction(productId, image.id, "down"))}
                  title="Mover para baixo" aria-label="Mover para baixo" className="rounded border border-black/15 p-2 hover:border-gold"><ArrowDown size={15} /></button>
                <button type="button" disabled={pending} onClick={() => {
                  if (window.confirm("Remover esta imagem do produto?")) run(() => removeProductImageAction(productId, image.id));
                }} title="Remover imagem" aria-label="Remover imagem" className="rounded border border-black/15 p-2 text-red-700 hover:border-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {status ? <p className="mt-3 text-sm text-taupe" role="status">{status}</p> : null}
    </div>
  );
}
