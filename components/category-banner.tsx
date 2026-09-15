import Image from "next/image";
import { BadgePercent, Clock3 } from "lucide-react";
import type { CategoryBannerContent } from "@/lib/category-banners";

type CategoryBannerProps = {
  banner: CategoryBannerContent;
  className?: string;
};

export function CategoryBanner({ banner, className = "" }: CategoryBannerProps) {
  return (
    <section
      aria-labelledby="category-banner-title"
      className={`relative isolate overflow-hidden rounded-lg border border-black/10 bg-[linear-gradient(115deg,#ffffff_0%,#fbfaf7_58%,#f5efe4_100%)] shadow-sm ${className}`}
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      <div className={banner.image ? "grid lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]" : ""}>
        <div className="relative z-10 flex min-h-44 min-w-0 flex-col justify-center px-5 py-6 sm:min-h-48 sm:px-8 sm:py-7 lg:min-h-60 lg:px-10">
          <p className="text-xs font-semibold uppercase text-gold">{banner.eyebrow}</p>
          <h1
            id="category-banner-title"
            className="mt-2 max-w-4xl break-words font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl lg:text-[2.75rem]"
          >
            {banner.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-taupe sm:text-base sm:leading-7">{banner.subtitle}</p>
          {banner.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-taupe">{banner.description}</p>
          ) : null}
          <div className="mt-4 flex min-w-0 flex-col items-start gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {banner.badge ? (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-gold/35 bg-white/85 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                <BadgePercent aria-hidden="true" size={14} strokeWidth={1.7} className="text-gold" />
                {banner.badge}
              </span>
            ) : null}
            {banner.note ? (
              <span className="inline-flex min-w-0 items-start gap-1.5 text-xs leading-5 text-ink/70">
                <Clock3 aria-hidden="true" size={14} strokeWidth={1.7} className="mt-0.5 shrink-0 text-gold" />
                <span>{banner.note}</span>
              </span>
            ) : null}
          </div>
        </div>

        {banner.image ? (
          <div className="relative aspect-[16/7] overflow-hidden border-t border-black/10 bg-pearl lg:aspect-auto lg:min-h-full lg:border-l lg:border-t-0">
            <Image
              src={banner.image}
              alt={banner.imageAlt ?? `${banner.title} na Marjouxs`}
              fill
              sizes="(max-width: 1023px) 100vw, 38vw"
              priority
              className="object-cover object-center"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
