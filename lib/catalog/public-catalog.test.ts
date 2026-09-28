import { describe, expect, it, vi } from "vitest";
import { getCatalogSource, isCatalogFallbackEnabled } from "@/lib/catalog/config";
import { normalizePublicDatabaseCatalog } from "@/lib/catalog/normalize-public";
import { CatalogUnavailableError, resolvePublicCatalog } from "@/lib/catalog/resolve";
import { searchProducts } from "@/lib/product-discovery";
import { selectRelatedProducts } from "@/lib/product-recommendations";
import { getProductSeoDescription, getProductSchema } from "@/lib/seo";
import type { DatabaseCatalog, DatabaseProduct } from "@/lib/catalog/database-products";
import type { Product } from "@/types/product";

const product: Product = {
  id: "legacy-1", slug: "anel-prata", name: "Anel Solitário Prata 950",
  category: "Anéis", subcategory: "Feminino", material: "Prata 950",
  price: 300, oldPrice: 400, priceLabel: "R$ 300,00", installments: "Até 6x sem juros",
  description: "Anel sob encomenda.", tags: ["solitário"], images: ["/produtos/anel-prata.jpg"],
  featured: true, isCustomOrder: false, allowWhatsappQuote: true, stockStatus: "Disponível"
};

function fixture(): DatabaseCatalog {
  const row: DatabaseProduct = {
    id: "uuid-1", legacy_id: product.id, name: product.name, slug: product.slug,
    category_id: "category-1", subcategory_id: "subcategory-1", material_id: "material-1",
    price: "300.00", old_price: "400.00", discount_percent: null, cash_discount_percent: null,
    installments_count: 6, price_label_override: product.priceLabel,
    installments_text_override: product.installments, description: product.description,
    tags: product.tags ?? [], stock_status: "made_to_order", sale_unit: "unit",
    is_custom_order: false, is_active: true, is_featured: true, allow_whatsapp_quote: true,
    engraving_available: false, engraving_included: false, jewelry_box_included: false,
    size_min: null, size_max: null
  };
  return {
    products: [row, { ...row, id: "manual", legacy_id: null, slug: "anel-feminino" },
      { ...row, id: "inactive", legacy_id: "legacy-2", slug: "inactive", is_active: false }],
    images: [{ id: "image-1", product_id: row.id, source_type: "local", path: product.images[0], is_primary: true, sort_order: 0 }],
    categories: [{ id: "category-1", name: "Anéis", slug: "aneis", is_active: true }],
    subcategories: [{ id: "subcategory-1", category_id: "category-1", name: "Feminino", slug: "feminino", is_active: true }],
    materials: [{ id: "material-1", name: "Prata 950", slug: "prata-950", is_active: true }]
  };
}

describe("catálogo público controlado", () => {
  it("usa static por padrão e para valor inválido", () => {
    expect(getCatalogSource({})).toBe("static");
    expect(getCatalogSource({ PRODUCT_CATALOG_SOURCE: "invalid" })).toBe("static");
    expect(getCatalogSource({ PRODUCT_CATALOG_SOURCE: "database" })).toBe("database");
    expect(isCatalogFallbackEnabled({})).toBe(true);
    expect(isCatalogFallbackEnabled({ PRODUCT_CATALOG_FALLBACK: "false" })).toBe(false);
  });

  it("não consulta o banco em static e usa o banco quando configurado", async () => {
    const reader = vi.fn().mockResolvedValue([product]);
    const log = vi.fn();
    expect(await resolvePublicCatalog({ source: "static", fallback: true, staticProducts: [], readDatabase: reader, log })).toEqual([]);
    expect(reader).not.toHaveBeenCalled();
    expect(await resolvePublicCatalog({ source: "database", fallback: true, staticProducts: [], readDatabase: reader, log })).toEqual([product]);
  });

  it("faz fallback apenas para falha de leitura", async () => {
    const reader = () => Promise.reject(new Error("secret connection detail"));
    const log = vi.fn();
    expect(await resolvePublicCatalog({ source: "database", fallback: true, staticProducts: [product], readDatabase: reader, log })).toEqual([product]);
    expect(log).toHaveBeenCalledWith("public_catalog", { catalog_source: "database", catalog_fallback_used: true });
    await expect(resolvePublicCatalog({ source: "database", fallback: false, staticProducts: [product], readDatabase: reader, log })).rejects.toBeInstanceOf(CatalogUnavailableError);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret connection detail");
  });

  it("não ressuscita slug ausente quando o banco responde normalmente", async () => {
    const rows = await resolvePublicCatalog({ source: "database", fallback: true, staticProducts: [product], readDatabase: async () => [{ ...product, slug: "other" }], log: vi.fn() });
    expect(rows.find((row) => row.slug === product.slug)).toBeUndefined();
  });

  it("normaliza preço, imagem local, status visual e exclui manual/inativo", () => {
    const rows = normalizePublicDatabaseCatalog(fixture(), [product]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: product.id, price: 300, oldPrice: 400, images: product.images, stockStatus: "Disponível", tags: product.tags });
    expect(rows[0].saleUnit).toBe("unit");
    expect(searchProducts(rows, "solitario")).toHaveLength(1);
    expect(searchProducts(rows, "prata")).toHaveLength(1);
    expect(rows.filter((row) => row.category === "Anéis" && row.subcategory === "Feminino")).toHaveLength(1);
    expect(selectRelatedProducts(rows[0], rows)).toEqual([]);
    expect(getProductSeoDescription(rows[0])).toBeTruthy();
    expect(getProductSchema(rows[0])).toBeTruthy();
  });

  it("preserva produto sem preço e regras das alianças", () => {
    const noPrice = { ...product, price: null, priceLabel: "Sob orçamento" };
    const catalog = fixture();
    catalog.products[0].price = null;
    catalog.products[0].price_label_override = "Sob orçamento";
    expect(normalizePublicDatabaseCatalog(catalog, [noPrice])[0].price).toBeNull();
    const alliance = { ...product, category: "Alianças" as const, subcategory: "Alianças Ouro 18k" };
    catalog.products[0].price = "300.00";
    catalog.products[0].price_label_override = product.priceLabel;
    catalog.categories[0].name = "Alianças";
    catalog.subcategories[0].name = "Alianças Ouro 18k";
    catalog.products[0].sale_unit = "pair";
    catalog.products[0].size_min = 8;
    catalog.products[0].size_max = 35;
    expect(normalizePublicDatabaseCatalog(catalog, [alliance])[0]).toMatchObject({ saleUnit: "pair", sizeMin: 8, sizeMax: 35 });
  });

  it("recusa preço ou slug incompatível com o checkout estático", () => {
    const catalog = fixture();
    catalog.products[0].price = "301.00";
    expect(() => normalizePublicDatabaseCatalog(catalog, [product])).toThrow("checkout_catalog_mismatch");
    catalog.products[0].price = "300.00";
    catalog.products[0].slug = "outro-slug";
    expect(() => normalizePublicDatabaseCatalog(catalog, [product])).toThrow("checkout_catalog_mismatch");
  });
});
