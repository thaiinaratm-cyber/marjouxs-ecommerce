"use client";

import { EyeOff } from "lucide-react";
import { useFormStatus } from "react-dom";

type DeactivateProductFormProps = {
  productId: string;
  action: (formData: FormData) => Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-ink bg-white px-4 text-sm font-bold text-ink transition hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-60"
    >
      <EyeOff size={17} aria-hidden="true" /> {pending ? "Desativando..." : "Desativar produto"}
    </button>
  );
}

export function DeactivateProductForm({ productId, action }: DeactivateProductFormProps) {
  return (
    <form
      action={action}
      className="mt-4"
      onSubmit={(event) => {
        if (!window.confirm("Desativar este produto? Ele passará para Rascunho/Inativo. Deseja continuar?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <SubmitButton />
    </form>
  );
}
