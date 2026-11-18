import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryBanner } from "@/components/category-banner";
import { getCategoryBanner } from "@/lib/category-banners";

const banner = getCategoryBanner({
  categorySlug: "aneis",
  eyebrow: "Anéis",
  fallbackTitle: "Anéis Marjouxs",
  fallbackSubtitle: "Anéis para diferentes ocasiões."
});

describe("CategoryBanner", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])("preserves heading, description and one set of benefits (artwork: %s)", (artwork) => {
    const html = renderToStaticMarkup(
      <CategoryBanner banner={banner} page={{ categorySlug: "aneis", materialSlug: artwork ? "prata" : undefined }} />
    );
    expect(html).toContain('aria-labelledby="category-banner-title"');
    expect(html).toMatch(/<h1[^>]*id="category-banner-title"[^>]*>Anéis Marjouxs<\/h1>/);
    expect(html).toContain(banner.subtitle);
    expect(html.split(banner.badge!).length - 1).toBe(1);
    expect(html.split(banner.note!).length - 1).toBe(1);
    if (artwork) {
      expect(html).toContain('src="/banners-categorias/aneis-prata950.png"');
      expect(html).toContain('alt="Anéis em Prata 950');
      expect(html).toContain('width="1774" height="887"');
    } else {
      expect(html).not.toContain("/banners-categorias/");
    }
  });
});
