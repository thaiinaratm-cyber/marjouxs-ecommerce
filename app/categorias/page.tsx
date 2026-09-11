import { ChevronRight } from "lucide-react";
import { AnalyticsLink } from "@/components/analytics-link";
import { categories } from "@/data/categories";
import { createCategoryClickEvent } from "@/lib/analytics";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "Categorias | Marjouxs"
};

export default function CategoriesPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Reveal>
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Categorias</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Encontre pela peça ideal</h1>
          <p className="mt-4 leading-7 text-taupe">Cada categoria foi organizada para facilitar a compra e o pedido de orçamento.</p>
        </div>
      </Reveal>
      <div className="grid gap-5 md:grid-cols-2">
        {categories.map((category, index) => (
          <Reveal key={category.slug} delay={Math.min(index, 5) * 60} distance={16} className="h-full">
            <AnalyticsLink
              href={`/categorias/${category.slug}`}
              analyticsEvents={createCategoryClickEvent(category.name, "category_page", `/categorias/${category.slug}`)}
              className="block h-full rounded-lg border border-black/10 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold hover:shadow-soft"
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
            </AnalyticsLink>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
