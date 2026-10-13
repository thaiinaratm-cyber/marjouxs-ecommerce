"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { refreshProductImagesAction } from "@/app/admin/(protected)/produtos/image-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ADMIN_PRODUCT_IMAGE_BUCKET,
  validateProductImage
} from "@/lib/admin/product-form";

type ProductImageUploadProps = {
  productId: string;
  productName: string;
};

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export function ProductImageUpload({ productId, productName }: ProductImageUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("Selecione uma imagem.");
      return;
    }

    const validationError = validateProductImage(file);
    if (validationError === "invalid_type") {
      setStatus("Use uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (validationError === "invalid_size") {
      setStatus("A imagem deve ter no máximo 10 MB.");
      return;
    }

    setIsUploading(true);
    setStatus(null);
    const supabase = createSupabaseBrowserClient();
    const extension = extensionByType[file.type];
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { data: existingImages, error: imagesError } = await supabase
      .from("ecommerce_product_images")
      .select("id,is_primary,sort_order")
      .eq("product_id", productId);

    if (imagesError) {
      setStatus("Não foi possível validar as imagens existentes.");
      setIsUploading(false);
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from(ADMIN_PRODUCT_IMAGE_BUCKET)
      .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });

    if (uploadError) {
      setStatus("Não foi possível enviar a imagem.");
      setIsUploading(false);
      return;
    }

    const hasPrimaryImage = (existingImages ?? []).some((image) => image.is_primary);
    const nextSortOrder = (existingImages ?? []).reduce(
      (highest, image) => Math.max(highest, image.sort_order),
      -1
    ) + 1;

    const { error: metadataError } = await supabase.from("ecommerce_product_images").insert({
      product_id: productId,
      source_type: "storage",
      path,
      alt_text: productName,
      sort_order: nextSortOrder,
      is_primary: !hasPrimaryImage
    });

    if (metadataError) {
      await supabase.storage.from(ADMIN_PRODUCT_IMAGE_BUCKET).remove([path]);
      setStatus("A imagem foi rejeitada ao registrar os metadados.");
      setIsUploading(false);
      return;
    }

    if (inputRef.current) inputRef.current.value = "";
    const refreshResult = await refreshProductImagesAction(productId);
    setStatus(refreshResult.ok ? "Imagem adicionada com segurança." : "Imagem adicionada. Atualize a página para vê-la.");
    setIsUploading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleUpload} className="grid gap-4 rounded-lg border border-black/10 bg-white p-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-ink">Adicionar imagem</h2>
        <p className="mt-1 text-sm leading-6 text-taupe">
          JPEG, PNG ou WebP, com até 10 MB. A primeira imagem será a principal.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="w-full rounded-md border border-black/15 bg-pearl px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-champagne file:px-3 file:py-2 file:font-semibold file:text-ink"
      />
      <button
        type="submit"
        disabled={isUploading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink bg-white px-4 text-sm font-bold text-ink transition hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        {isUploading ? <Loader2 className="animate-spin" size={17} /> : <ImagePlus size={17} />}
        {isUploading ? "Enviando..." : "Adicionar imagem"}
      </button>
      {status ? <p className="text-sm text-taupe" role="status">{status}</p> : null}
    </form>
  );
}
