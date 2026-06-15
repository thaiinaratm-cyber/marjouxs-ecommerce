import type { ReactNode } from "react";
import { HelpCard } from "@/components/help-card";

type InstitutionalSection = {
  title: string;
  content: ReactNode;
};

type InstitutionalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InstitutionalSection[];
};

export function InstitutionalPage({ eyebrow, title, intro, sections }: InstitutionalPageProps) {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 leading-7 text-taupe">{intro}</p>

        <div className="mt-8 grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-serif text-2xl font-semibold text-ink">{section.title}</h2>
              <div className="mt-3 grid gap-3 text-sm leading-7 text-taupe sm:text-base">{section.content}</div>
            </article>
          ))}
        </div>
      </section>
      <HelpCard />
    </>
  );
}
