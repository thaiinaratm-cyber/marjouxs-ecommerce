import { describe, expect, it } from "vitest";
import { getCategoryBanner } from "@/lib/category-banners";

const configuredBanners = [
  ["aliancas", "ouro-18k-750", "Alianças em Ouro 18k"],
  ["aliancas", "prata-950", "Alianças em Prata 950"],
  ["aneis", "ouro-18k", "Anéis em Ouro 18k"],
  ["aneis", "prata-950", "Anéis em Prata 950"],
  ["brincos", "ouro-18k", "Brincos em Ouro 18k"],
  ["brincos", "prata-950", "Brincos em Prata 950"],
  ["correntes", "ouro-18k", "Correntes em Ouro 18k"],
  ["correntes", "prata-925", "Correntes em Prata 925"],
  ["pulseiras", "ouro-18k", "Pulseiras em Ouro 18k"],
  ["pulseiras", "prata-925", "Pulseiras em Prata 925"],
  ["braceletes", "ouro-18k", "Braceletes em Ouro 18k"],
  ["braceletes", "prata-950", "Braceletes em Prata 950"],
  ["pingentes", "ouro-18k", "Pingentes em Ouro 18k"],
  ["pingentes", "prata-950", "Pingentes em Prata 950"],
  ["aneis", "formatura", "Joias de Formatura"],
  ["brincos", "infantil", "Linha Infantil"],
  ["aliancas", "banhado-a-ouro", "Joias Banhadas"],
  ["aliancas", "moeda", "Joias em Moeda"]
] as const;

describe("getCategoryBanner", () => {
  it.each(configuredBanners)("resolve %s/%s", (categorySlug, variantSlug, expectedTitle) => {
    const banner = getCategoryBanner({
      categorySlug,
      variantSlug,
      eyebrow: "Categoria",
      fallbackTitle: "Título padrão",
      fallbackSubtitle: "Texto padrão"
    });

    expect(banner.title).toBe(expectedTitle);
    expect(banner.subtitle).not.toBe("Texto padrão");
  });

  it("mantém título e texto da rota quando não existe preset específico", () => {
    expect(getCategoryBanner({
      categorySlug: "relogios",
      variantSlug: "masculinos",
      eyebrow: "Relógios",
      fallbackTitle: "Relógios Marjouxs",
      fallbackSubtitle: "Relógios e serviços técnicos de relojoaria."
    })).toEqual({
      eyebrow: "Relógios",
      title: "Relógios Marjouxs",
      subtitle: "Relógios e serviços técnicos de relojoaria.",
      description: undefined,
      image: undefined,
      imageAlt: undefined,
      badge: "10% OFF no Pix",
      note: "Peças sob encomenda • confecção em 3 a 5 dias úteis"
    });
  });

  it("usa a imagem real recebida da seleção atual", () => {
    const banner = getCategoryBanner({
      categorySlug: "aliancas",
      variantSlug: "prata-950",
      eyebrow: "Alianças",
      fallbackTitle: "Alianças",
      fallbackSubtitle: "Seleção Marjouxs.",
      image: "/produtos/alianca-prata-950.jpeg",
      imageAlt: "Aliança em Prata 950"
    });

    expect(banner.image).toBe("/produtos/alianca-prata-950.jpeg");
    expect(banner.imageAlt).toBe("Aliança em Prata 950");
  });
});
