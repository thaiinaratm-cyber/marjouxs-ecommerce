import { afterEach, describe, expect, it, vi } from "vitest";
import { getCategoryBannerImage } from "@/lib/category-banner-images";
import { categoryFilters } from "@/lib/category-navigation";

afterEach(() => vi.restoreAllMocks());

describe("category artwork", () => {
  it("resolves the existing category filter URLs to real, dimensioned images", () => {
    const mappedFilters = Object.entries(categoryFilters).flatMap(([categorySlug, filters]) =>
      filters.map(({ slug }) => ({ categorySlug, variantSlug: slug }))
    );

    for (const page of mappedFilters) {
      const image = getCategoryBannerImage(page);
      expect(image, JSON.stringify(page)).toBeDefined();
      expect(image?.src).toMatch(/^\/banners-categorias\/[^/]+\.png$/);
      expect(image?.width).toBeGreaterThan(0);
      expect(image?.height).toBeGreaterThan(0);
      expect(image?.alt).toContain("Marjouxs");
    }
  });

  it.each(["formatura", "perola"])("uses the specific gold ring artwork for %s", (variantSlug) => {
    expect(getCategoryBannerImage({
      categorySlug: "aneis", variantSlug, pathname: `/aneis/ouro-18k/${variantSlug}`
    })?.src).toBe(`/banners-categorias/anel-${variantSlug}-ouro18k.png`);
  });

  it.each([
    ["aliancas", "moeda", undefined, "alianças-moeda.png"],
    ["aliancas", "prata-950", undefined, "alianças-prata950.png"],
    ["aneis", "masculino", "/aneis/ouro-18k/masculino", "aneis-ouro-18k-masculinos.png"],
    ["aneis", "feminino", "/aneis/ouro-18k/feminino", "anel-ouro18k-femininos.png"],
    ["aneis", "masculino", "/aneis/prata-950/masculino", "aneis-prata950-masculino.png"],
    ["aneis", "feminino", "/aneis/prata-950/feminino", "aneis-prata950-feminino.png"]
  ])("maps the new %s / %s artwork at %s", (categorySlug, variantSlug, pathname, filename) => {
    const image = getCategoryBannerImage({ categorySlug, variantSlug, pathname });
    const [width, height] = filename === "alianças-prata950.png" ? [2172, 724] : [2048, 768];
    expect(image?.src).toBe(`/banners-categorias/${filename}`);
    expect(image?.width).toBe(width);
    expect(image?.height).toBe(height);
    expect(image?.alt).toContain("Marjouxs");
  });

  it.each(["femininos", "masculinos"])("matches the existing watch link for %s", (gender) => {
    expect(getCategoryBannerImage({ categorySlug: "relogios", variantSlug: `relogios-${gender}` })?.src)
      .toBe(`/banners-categorias/relogios-${gender}.png`);
  });

  it.each(["correntes", "pulseiras"])("keeps the approved 925 alias for %s", (categorySlug) => {
    expect(getCategoryBannerImage({ categorySlug, variantSlug: "prata-925" })?.src)
      .toBe(`/banners-categorias/${categorySlug}-prata950.png`);
  });

  it("retains fallback for categories and subcategories without matching artwork", () => {
    for (const page of [
      { categorySlug: "aliancas" },
      { categorySlug: "aneis", variantSlug: "masculino" },
      { categorySlug: "aneis", variantSlug: "perola", pathname: "/aneis/prata-950/perola" }
    ]) expect(getCategoryBannerImage(page)).toBeUndefined();
  });

  it("retains fallback if a mapped image is absent", () => {
    vi.spyOn(process, "cwd").mockReturnValue(`${process.cwd()}/missing-banner-fixture`);
    expect(getCategoryBannerImage({ categorySlug: "aneis", variantSlug: "ouro-18k" })).toBeUndefined();
  });
});
