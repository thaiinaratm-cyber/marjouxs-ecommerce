import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { categories } from "@/data/categories";

export const metadata = {
  title: "Categorias | Antoér Joalheria"
};

export default function CategoriesPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Categorias</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Encontre pela peça ideal</h1>
        <p className="mt-4 leading-7 text-taupe">Cada categoria foi organizada para facilitar a compra e o pedido de orçamento.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {categories.map((category) => (
          <Link
            href={`/categorias/${category.slug}`}
            key={category.slug}
            className="rounded-lg border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-gold hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl font-semibold text-ink">{category.name}</h2>
                <p className="mt-2 text-sm leading-6 text-taupe">{category.description}</p>
              </div>
              <ChevronRight className="text-gold" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {category.subcategories.map((subcategory) => (
                <span key={subcategory} className="rounded-full bg-champagne px-3 py-1 text-xs font-medium text-ink">
                  {subcategory}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
