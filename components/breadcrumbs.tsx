import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbSchema, serializeJsonLd, type BreadcrumbItem } from "@/lib/seo";

export function Breadcrumbs({ items, className = "" }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(getBreadcrumbSchema(items)) }}
      />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-taupe sm:gap-2">
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1;
            return (
              <li key={`${item.href}-${item.name}`} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                {index > 0 ? <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-gold/70" /> : null}
                {isCurrent ? (
                  <span aria-current="page" className="line-clamp-1 text-ink">{item.name}</span>
                ) : (
                  <Link href={item.href} className="transition hover:text-gold">{item.name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
