import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import { getMerchantItems, renderMerchantXml, escapeMerchantXml } from "@/lib/google-merchant";
import { getGoogleProductId } from "@/lib/google-product-fields";
import { getProductSchema, organizationWebsiteSchema } from "@/lib/seo";
import { getVisibleProducts } from "@/lib/products";
import type { Product } from "@/types/product";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const product: Product = {
  id: "alianca-950", slug: "alianca-950", name: "Aliança d'Água & Luz",
  description: "Prata 950, acabamento polido.", category: "Alianças",
  subcategory: "Alianças Prata", material: "Prata 950", price: 590,
  priceLabel: "R$ 590,00", installments: "6x", images: ["/produtos/alianca.png"],
  featured: false, isCustomOrder: true, allowWhatsappQuote: true, stockStatus: "Sob encomenda"
};
const images = new Set(product.images);
const item = (overrides: Partial<Product> = {}) => getMerchantItems([{ ...product, ...overrides }], images)[0];

describe("Google Merchant", () => {
  it("preserva dados reais e não usa preço Pix ou parcela", () => {
    expect(item()).toMatchObject({
      id: product.id, title: product.name, price: "590.00 BRL",
      link: "https://marjouxsjoias.com.br/produtos/alianca-950",
      image_link: "https://marjouxsjoias.com.br/produtos/alianca.png",
      availability: "in_stock", brand: "Marjouxs Joias", identifier_exists: "false",
      condition: "new", material: "Prata 950", google_product_category: "200"
    });
    expect(item()).not.toHaveProperty("sale_price");
    for (const field of ["gtin", "mpn", "size", "color", "review", "aggregateRating"]) {
      expect(item()).not.toHaveProperty(field);
    }
  });

  it("usa preço anterior e promoção reais; preço efetivo coincide com JSON-LD", () => {
    const sale = { ...product, oldPrice: 700 };
    const feed = getMerchantItems([sale], images)[0];
    expect(feed.price).toBe("700.00 BRL");
    expect(feed.sale_price).toBe("590.00 BRL");
    expect(getProductSchema(sale).offers).toMatchObject({ price: "590.00", availability: "https://schema.org/InStock" });
    expect(item({ oldPrice: 400 })).not.toHaveProperty("sale_price");
    expect(item({ oldPrice: NaN })).not.toHaveProperty("sale_price");
  });

  it.each([null, 0, -1, NaN, Infinity, 1.001])("exclui preço inválido %s", (price) => {
    expect(item({ price })).toBeUndefined();
  });

  it("exclui serviço, indisponível, orçamento, imagem ausente e rota inválida", () => {
    for (const override of [
      { stockStatus: "Indisponível" }, { stockStatus: "Serviço" }, { category: "Serviços" },
      { priceLabel: "Sob orçamento" }, { images: [] }, { images: ["/produtos/ausente.jpg"] },
      { images: ["https://example.com/a.jpg"] }, { slug: "../checkout" }, { id: "" }, { description: "" }
    ] as Partial<Product>[]) {
      expect(item(override), JSON.stringify(override)).toBeUndefined();
    }
  });

  it("usa apenas imagens adicionais reais e distintas, preservando a principal", () => {
    const extra = "/produtos/extra.jpg";
    const feed = getMerchantItems([{ ...product, images: [...product.images, extra, extra, "/produtos/ausente.jpg"] }],
      new Set([...Array.from(images), extra]))[0];
    expect(feed.additional_image_link).toEqual(["https://marjouxsjoias.com.br/produtos/extra.jpg"]);
    expect(feed.image_link).toContain("alianca.png");
  });

  it("escapa acentos, aspas e símbolos e remove caracteres XML ilegais", () => {
    expect(escapeMerchantXml('Água & <prata> "950" d\'ouro')).toBe("Água &amp; &lt;prata&gt; &quot;950&quot; d&apos;ouro");
    expect(escapeMerchantXml("a" + String.fromCharCode(0, 1, 0xd800) + "💎")).toBe("a💎");
    const xml = renderMerchantXml([item({ description: "<p>Joia & beleza</p><script>alert(1)</script>" })]);
    expect(xml).toContain('encoding="UTF-8"');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("Aliança d&apos;Água &amp; Luz");
    expect(xml).toContain("<g:description>Joia &amp; beleza</g:description>");
    expect(xml).not.toMatch(/undefined|null|alert\(1\)/);
  });

  it("mantém IDs estáveis e limita IDs longos sem gerar MPN", () => {
    const id = "produto-muito-longo-".repeat(5);
    const feed = item({ id });
    expect(feed.id.length).toBeLessThanOrEqual(50);
    expect(item({ id, name: "Outro nome", price: 600 }).id).toBe(feed.id);
    expect(getProductSchema({ ...product, id }).sku).toBe(feed.id);
    expect(getGoogleProductId(id + "2")).not.toBe(feed.id);
  });

  it("recusa colisões de ID e páginas duplicadas", () => {
    expect(() => getMerchantItems([product, { ...product, slug: "outro" }], images)).toThrow("Duplicate");
    expect(() => getMerchantItems([product, { ...product, id: "outro" }], images)).toThrow("Duplicate");
    expect(() => getMerchantItems([product, { ...product, id: product.id.toUpperCase(), slug: "outro" }], images)).toThrow("Duplicate");
  });

  it("mantém somente o link factual de devoluções no schema da loja", () => {
    const store = organizationWebsiteSchema["@graph"].find((entry) => entry["@type"] === "JewelryStore");
    expect(store?.hasMerchantReturnPolicy).toEqual({
      "@type": "MerchantReturnPolicy", merchantReturnLink: "https://marjouxsjoias.com.br/trocas-e-devolucoes"
    });
    expect(getProductSchema(product).offers).not.toHaveProperty("shippingDetails");
    expect(getProductSchema(product).offers).not.toHaveProperty("hasMerchantReturnPolicy");
  });

  it("mantém identidade, preço efetivo e disponibilidade consistentes em todo catálogo elegível", () => {
    const available = new Set(products.flatMap((entry) => entry.images).filter((image) => {
      const file = path.join(process.cwd(), "public", image);
      return existsSync(file) && statSync(file).isFile() && statSync(file).size > 0;
    }));
    const publicProducts = getVisibleProducts(products);
    const entries = getMerchantItems(publicProducts, available);
    expect(entries.length).toBeGreaterThan(300);
    expect(new Set(entries.map((entry) => entry.id.toLowerCase())).size).toBe(entries.length);
    for (const entry of entries) {
      const source = publicProducts.find((candidate) => getGoogleProductId(candidate.id) === entry.id)!;
      const schema = getProductSchema(source);
      expect(schema.sku).toBe(entry.id);
      expect(schema.name).toBe(entry.title);
      expect(schema.url).toBe(entry.link);
      expect(schema.offers).toMatchObject({
        price: (entry.sale_price ?? entry.price).replace(" BRL", ""), availability: "https://schema.org/InStock"
      });
      expect(entry.id.length).toBeLessThanOrEqual(50);
    }
    expect(entries.some((entry) => entry.image_link.endsWith("/anel-teste-01.jpg"))).toBe(available.has("/produtos/anel-teste-01.jpg"));
  });
});
