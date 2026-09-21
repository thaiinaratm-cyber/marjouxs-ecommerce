import { describe, expect, it } from "vitest";
import {
  getBreadcrumbSchema,
  getProductAvailability,
  getProductBreadcrumbs,
  getProductSchema,
  getProductSeoDescription,
  organizationWebsiteSchema
} from "@/lib/seo";
import { getVisibleProducts } from "@/lib/products";
import type { Product } from "@/types/product";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "alianca-prata-950",
    name: "Aliança Prata 950 Chanfrada",
    slug: "alianca-prata-950-chanfrada",
    category: "Alianças",
    subcategory: "Alianças Prata",
    material: "Prata 950",
    price: 590,
    priceLabel: "R$ 590,00",
    installments: "Até 6x sem juros",
    description: "Aliança feita sob encomenda. Gravação dos nomes e caixinha inclusas.",
    images: ["/produtos/alianca-prata-950-chanfrada.png"],
    featured: false,
    isCustomOrder: true,
    allowWhatsappQuote: true,
    stockStatus: "Sob encomenda",
    ...overrides
  };
}

describe("SEO de produto", () => {
  it("gera uma descrição comercial baseada somente nos dados reais", () => {
    const description = getProductSeoDescription(product());

    expect(description).toContain("Aliança Prata 950 Chanfrada");
    expect(description).toContain("Disponível sob encomenda");
    expect(description).toContain("Gravação inclusa");
    expect(description).toContain("10% OFF no Pix");
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("mantém as descrições geradas do catálogo público dentro do limite", () => {
    for (const catalogProduct of getVisibleProducts()) {
      const description = getProductSeoDescription(catalogProduct);

      expect(description.length, catalogProduct.slug).toBeGreaterThan(0);
      expect(description.length, catalogProduct.slug).toBeLessThanOrEqual(160);
    }
  });

  it("mantém o preço cheio sem inventar disponibilidade para produto sob encomenda", () => {
    const schema = getProductSchema(product()) as {
      offers: {
        price: string;
        priceCurrency: string;
        availability?: string;
      };
      aggregateRating?: unknown;
      review?: unknown;
    };

    expect(schema.offers).toMatchObject({
      price: "590.00",
      priceCurrency: "BRL"
    });
    expect(schema.offers.availability).toBeUndefined();
    expect(schema.aggregateRating).toBeUndefined();
    expect(schema.review).toBeUndefined();
  });

  it("não mascara indisponibilidade explícita com o texto da descrição", () => {
    const unavailable = product({ stockStatus: "Indisponível" });
    expect(getProductAvailability(unavailable)).toBe("https://schema.org/OutOfStock");
  });

  it("usa InStock somente para produto disponível que não é sob encomenda", () => {
    const available = product({
      stockStatus: "Disponível",
      isCustomOrder: false,
      description: "Peça disponível para compra."
    });
    expect(getProductAvailability(available)).toBe("https://schema.org/InStock");
  });
});

describe("breadcrumbs e schemas centrais", () => {
  it("gera navegação absoluta e ordenada para o produto", () => {
    const items = getProductBreadcrumbs(product());
    const schema = getBreadcrumbSchema(items);

    expect(items.map((item) => item.name)).toEqual([
      "Home",
      "Alianças",
      "Prata 950",
      "Aliança Prata 950 Chanfrada"
    ]);
    expect(schema.itemListElement.at(-1)).toMatchObject({
      position: 4,
      item: "https://marjouxsjoias.com.br/produtos/alianca-prata-950-chanfrada"
    });
  });

  it("mantém LocalBusiness e WebSite em um único grafo, com busca pública real", () => {
    const graph = organizationWebsiteSchema["@graph"];
    const store = graph.find((item) => item["@type"] === "JewelryStore");
    const website = graph.find((item) => item["@type"] === "WebSite");

    expect(store).toMatchObject({
      name: "Marjouxs Joalheria",
      telephone: "+5511915818241"
    });
    expect(website).toMatchObject({
      potentialAction: {
        target: {
          urlTemplate: "https://marjouxsjoias.com.br/produtos?busca={search_term_string}"
        }
      }
    });
  });
});
