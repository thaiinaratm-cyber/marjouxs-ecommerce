import Markdown from "react-markdown";
import type { ReactNode } from "react";

const elements = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "ul", "ol", "li",
  "br", "blockquote", "hr", "code", "pre", "a"];

function safeLink(url: string) {
  if (/[\u0000-\u0020\u007f\\]/.test(url)) return "";
  if (/^#|^\/(?!\/)/.test(url)) return url;
  try {
    const target = new URL(url);
    return target.protocol === "https:" && !target.username && !target.password ? target.href : "";
  } catch {
    return "";
  }
}

function DescriptionHeading({ children }: { children?: ReactNode }) {
  return <h3 className="font-serif text-xl font-semibold text-ink">{children}</h3>;
}

export function ProductDescription({ description }: { description: string }) {
  if (!description.trim()) return null;
  return (
    <section aria-labelledby="product-description-title" className="mt-8 border-t border-black/10 pt-6">
      <h2 id="product-description-title" className="font-serif text-2xl font-semibold text-ink">Descrição</h2>
      <div className="mt-4 min-w-0 max-w-4xl space-y-4 leading-7 text-taupe [overflow-wrap:anywhere] [&_p]:whitespace-pre-line [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gold/40 [&_blockquote]:pl-4 [&_pre]:whitespace-pre-wrap">
        <Markdown skipHtml allowedElements={elements} unwrapDisallowed urlTransform={safeLink}
          components={{
            h1: DescriptionHeading, h2: DescriptionHeading, h3: DescriptionHeading,
            h4: DescriptionHeading, h5: DescriptionHeading, h6: DescriptionHeading,
            a: ({ children, href }) => href
              ? <a href={href} className="text-ink underline decoration-gold underline-offset-4">{children}</a>
              : <>{children}</>
          }}>
          {description}
        </Markdown>
      </div>
    </section>
  );
}
