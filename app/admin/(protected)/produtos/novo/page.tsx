import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createDraftProductAction } from "@/app/admin/(protected)/produtos/actions";
import { ProductForm } from "@/components/admin/product-form";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getAdminTaxonomy } from "@/lib/admin/catalog";

const errors: Record<string, string> = {
  duplicate: "Já existe um produto com este slug.",
  invalid_fields: "Revise os campos obrigatórios.",
  invalid_price: "Informe um preço válido em reais ou deixe o campo vazio.",
  save: "Não foi possível criar o rascunho.",
  taxonomy: "A categoria, subcategoria ou material selecionado não é válido."
};

type NewProductPageProps = { searchParams?: { error?: string } };

export default async function NewAdminProductPage({ searchParams }: NewProductPageProps) {
  const { supabase } = await requireActiveAdmin();
  const taxonomy = await getAdminTaxonomy(supabase);
  const error = searchParams?.error ? errors[searchParams.error] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/produtos" className="inline-flex items-center gap-2 text-sm font-semibold text-taupe transition hover:text-gold">
        <ArrowLeft size={16} aria-hidden="true" /> Voltar aos produtos
      </Link>
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Novo produto</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Criar rascunho</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-taupe">
          O produto será salvo inativo. Depois, adicione a imagem principal e faça a ativação separadamente.
        </p>
      </div>

      {error ? <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div> : null}

      <div className="mt-7"><ProductForm action={createDraftProductAction} taxonomy={taxonomy} submitLabel="Salvar como rascunho" /></div>
    </div>
  );
}
