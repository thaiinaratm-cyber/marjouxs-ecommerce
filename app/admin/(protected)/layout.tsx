import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, Package, Plus } from "lucide-react";
import { logoutAction } from "@/app/admin/(protected)/actions";
import { requireActiveAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  await requireActiveAdmin();

  return (
    <section className="min-h-[70vh] bg-pearl/80">
      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Administração</p>
            <p className="mt-1 font-serif text-xl font-semibold text-ink">Produtos Marjouxs</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Navegação administrativa">
            <Link
              href="/admin/produtos"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-3 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold"
            >
              <Package size={16} aria-hidden="true" />
              Produtos
            </Link>
            <Link
              href="/admin/produtos/novo"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white transition hover:bg-gold"
            >
              <Plus size={16} aria-hidden="true" />
              Novo produto
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-taupe transition hover:bg-black/5 hover:text-ink"
              >
                <LogOut size={16} aria-hidden="true" />
                Sair
              </button>
            </form>
          </nav>
        </div>
      </div>
      {children}
    </section>
  );
}
