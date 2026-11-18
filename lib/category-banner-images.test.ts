import { afterEach, describe, expect, it, vi } from "vitest";
import { getCategoryBannerImage } from "@/lib/category-banner-images";
import { categoryFilters } from "@/lib/category-navigation";
import { categories } from "@/data/categories";

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

  it.each([
    ["aneis", "masculino", "ouro-18k", "aneis-ouro-18k-masculinos.png"],
    ["aneis", "masculino", "prata", "aneis-prata950-masculino.png"],
    ["aneis", "feminino", "ouro-18k", "anel-ouro18k-femininos.png"],
    ["aneis", "feminino", "prata", "aneis-prata950-feminino.png"],
    ["aneis", "perola", undefined, "anel-perola-ouro18k.png"],
    ["aneis", "formatura", "ouro-18k", "anel-formatura-ouro18k.png"],
    ["aneis", "formatura", undefined, "anel-formatura-ouro18k.png"],
    ["aneis", undefined, "ouro-18k", "aneis-ouro18k.png"],
    ["aneis", undefined, "prata", "aneis-prata950.png"],
    ["pulseiras", "pulseiras-masculinas", "ouro-18k", "pulseiras-ouro18k.png"],
    ["pulseiras", "pulseiras-masculinas", "prata", "pulseiras-prata950.png"],
    ["pulseiras", "pulseiras-femininas", "ouro-18k", "pulseiras-ouro18k.png"],
    ["pulseiras", "pulseiras-femininas", "prata", "pulseiras-prata950.png"],
    ["pulseiras", "pulseiras-infantis", undefined, "pulseira-infantil-ouro18k.png"],
    ["correntes", "correntes-masculinas", "ouro-18k", "correntes-ouro18k.png"],
    ["correntes", "correntes-masculinas", "prata", "correntes-prata950.png"],
    ["correntes", "correntes-femininas", "ouro-18k", "correntes-ouro18k.png"],
    ["correntes", "correntes-femininas", "prata", "correntes-prata950.png"],
    ["pingentes", "pingentes-masculinos", "ouro-18k", "pingentes-ouro18k.png"],
    ["pingentes", "pingentes-masculinos", "prata", "pingentes-prata950.png"],
    ["pingentes", "pingentes-femininos", "ouro-18k", "pingentes-ouro18k.png"],
    ["pingentes", "pingentes-femininos", "prata", "pingentes-prata950.png"],
    ["brincos", undefined, "ouro-18k", "brincos-ouro18k.png"],
    ["brincos", undefined, "prata", "brincos-prata950.png"],
    ["brincos", "brincos-infantis", undefined, "brinco-infantil-ouro18k.png"],
    ["brincos", "infantil", "ouro-18k", "brinco-infantil-ouro18k.png"],
    ["brincos", "infantil", "prata", "brincos-prata950.png"],
    ["braceletes", undefined, "ouro-18k", "bracelete-ouro18k.png"],
    ["braceletes", undefined, "prata", "braceletes-prata950.png"],
    ["aliancas", undefined, "ouro-18k", "aliancas-ouro18k.png"],
    ["aliancas", undefined, "ouro-18k-750", "aliancas-ouro18k.png"],
    ["aliancas", "ouro-18k-750", undefined, "aliancas-ouro18k.png"],
    ["aliancas", undefined, "prata", "alianças-prata950.png"],
    ["aliancas", "aliancas-banhado-a-ouro", undefined, "aliancas-banhado-a-ouro.png"],
    ["aliancas", "banhado-a-ouro", undefined, "aliancas-banhado-a-ouro.png"],
    ["aliancas", "moeda", undefined, "alianças-moeda.png"],
    ["relogios", "relogios-masculinos", undefined, "relogios-masculinos.png"],
    ["relogios", "relogios-femininos", undefined, "relogios-femininos.png"]
  ])("resolves category query artwork for %s / %s / %s", (categorySlug, subcategorySlug, materialSlug, file) => {
    expect(getCategoryBannerImage({ categorySlug, subcategorySlug, materialSlug })?.src)
      .toBe(`/banners-categorias/${file}`);
  });

  it.each([
    ["aliancas", undefined],
    ["aneis", undefined],
    ["aneis", "feminino"],
    ["braceletes", undefined],
    ["brincos", undefined],
    ["correntes", "correntes-masculinas"],
    ["pingentes", "pingentes-femininos"],
    ["pulseiras", "pulseiras-femininas"]
  ])("unifies silver artwork aliases for %s / %s", (categorySlug, subcategorySlug) => {
    const resolve = (materialSlug: string) => getCategoryBannerImage({ categorySlug, subcategorySlug, materialSlug });
    const silver = resolve("prata");
    expect(silver).toBeDefined();
    expect(resolve("prata-925")).toEqual(silver);
    expect(resolve("prata-950")).toEqual(silver);
  });

  it.each(categories.map(({ slug }) => slug))("keeps the generic hero at the %s root", (categorySlug) => {
    expect(getCategoryBannerImage({ categorySlug })).toBeUndefined();
  });

  it("ignores repeated query params and leaves unknown or incomplete selections generic", () => {
    for (const page of [
      { materialSlug: ["prata", "ouro-18k"] },
      { subcategorySlug: ["perola", "formatura"] },
      { subcategorySlug: "masculino" },
      { materialSlug: "../../prata-950" },
      { subcategorySlug: "desconhecida", materialSlug: "outro" }
    ]) expect(getCategoryBannerImage({ categorySlug: "aneis", ...page })).toBeUndefined();
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
