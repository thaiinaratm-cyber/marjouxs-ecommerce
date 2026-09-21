import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("rotas técnicas de SEO", () => {
  it("inclui páginas públicas, produtos e subcategorias no sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain("https://marjouxsjoias.com.br/");
    expect(urls).toContain("https://marjouxsjoias.com.br/produtos");
    expect(urls).toContain("https://marjouxsjoias.com.br/categorias/aliancas?subcategoria=prata-950");
    expect(urls).toContain("https://marjouxsjoias.com.br/aneis/ouro-18k/formatura");
    expect(urls.some((url) => url.startsWith("https://marjouxsjoias.com.br/produtos/"))).toBe(true);
  });

  it("não inclui áreas transacionais ou privadas no sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/checkout"))).toBe(false);
    expect(urls.some((url) => url.includes("/carrinho"))).toBe(false);
    expect(urls.some((url) => url.includes("/acompanhar-pedido"))).toBe(false);
    expect(urls.some((url) => url.includes("/api/"))).toBe(false);
  });

  it("desencoraja rastreamento das áreas operacionais sem bloquear assets", () => {
    const rules = robots().rules;

    expect(rules).toMatchObject({
      userAgent: "*",
      allow: "/"
    });
    expect(rules).toHaveProperty("disallow");
    expect(robots().sitemap).toBe("https://marjouxsjoias.com.br/sitemap.xml");
  });
});
