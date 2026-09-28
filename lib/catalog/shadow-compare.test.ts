import { describe, expect, it } from "vitest";

import { products } from "@/data/products";
import { getProductBySlug } from "@/lib/products";
import { mapLegacyProduct, type DatabaseSnapshot, type ImageAudit } from "@/scripts/migrate-products-to-supabase";
import type { Product } from "@/types/product";

import type { DatabaseCatalog, DatabaseProduct, DatabaseProductImage } from "./database-products";
import { compareStaticAndDatabaseCatalog, shadowMetrics } from "./shadow-compare";
import { renderShadowReport } from "./shadow-report";

const taxonomy: DatabaseSnapshot = {
  visibility: "service-role",
  categories: [
    { id: "rings", name: "Anéis", slug: "aneis", is_active: true },
    { id: "alliances", name: "Alianças", slug: "aliancas", is_active: true },
    { id: "services", name: "Serviços", slug: "servicos", is_active: false }
  ],
  subcategories: [
    { id: "feminine", category_id: "rings", name: "Feminino", slug: "feminino", is_active: true },
    { id: "gold-alliance", category_id: "alliances", name: "Alianças Ouro 18k", slug: "aliancas-ouro-18k", is_active: true },
    { id: "repair", category_id: "services", name: "Gravação", slug: "gravacao", is_active: false }
  ],
  materials: [
    { id: "gold", name: "Ouro 18k", slug: "ouro-18k", is_active: true },
    { id: "silver", name: "Prata 950", slug: "prata-950", is_active: true },
    { id: "technical", name: "Serviço técnico", slug: "servico-tecnico", is_active: false }
  ],
  products: [],
  counts: { products: 0, images: 0 }
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "ring-1",
    slug: "ring-1",
    name: "Anel Ouro 18k",
    category: "Anéis",
    subcategory: "Feminino",
    material: "Ouro 18k",
    price: 249.9,
    oldPrice: null,
    installmentsCount: 12,
    priceLabel: "R$ 249,90",
    installments: "Até 12x sem juros",
    description: "Anel em ouro 18k.",
    images: ["/produtos/ring-1.jpg"],
    featured: false,
    isCustomOrder: false,
    allowWhatsappQuote: true,
    stockStatus: "Disponível",
    ...overrides
  };
}

const validAudit: ImageAudit = {
  valid: [{ path: "/produtos/ring-1.jpg", source_type: "local", is_primary: true, sort_order: 0, alt_text: "Anel Ouro 18k" }],
  placeholders: [], missing: [], invalid: []
};

function fixture(product = makeProduct(), audit: ImageAudit = validAudit) {
  const plan = mapLegacyProduct(product, taxonomy, audit);
  const row = { ...plan.row, id: "database-ring-1", is_active: plan.activationCandidate } as DatabaseProduct;
  const images: DatabaseProductImage[] = plan.images.map((image, index) => ({
    id: `image-${index}`, product_id: row.id, source_type: image.source_type,
    path: image.path, is_primary: image.is_primary, sort_order: image.sort_order
  }));
  const manual = { ...row, id: "manual-1", legacy_id: null, slug: "anel-feminino", name: "Anel feminino", is_active: true };
  const manualImage = { id: "manual-image", product_id: manual.id, source_type: "storage", path: "manual.jpg", is_primary: true, sort_order: 0 };
  const catalog: DatabaseCatalog = {
    products: [row, manual],
    images: [...images, manualImage],
    categories: taxonomy.categories,
    subcategories: taxonomy.subcategories,
    materials: taxonomy.materials
  };
  const audits = new Map([[product.id, audit]]);
  return { product, row, catalog, audits };
}

function compare(f: ReturnType<typeof fixture>) {
  return compareStaticAndDatabaseCatalog([f.product], f.catalog, f.audits);
}

describe("catálogo em modo sombra", () => {
  it("pareia produto comum por legacy_id sem diferença crítica", () => {
    const result = compare(fixture());
    expect(result.matchedCount).toBe(1);
    expect(shadowMetrics(result).critical_diff_count).toBe(0);
  });

  it("compara 249,90 e 249.9 como mesmo decimal", () => {
    const f = fixture();
    f.row.price = "249.90";
    expect(compare(f).prices).toMatchObject({ equal: 1, divergent: 0 });
  });

  it("preserva produto sem preço", () => {
    const result = compare(fixture(makeProduct({ price: null })));
    expect(result.prices.withoutPrice).toBe(1);
    expect(shadowMetrics(result).critical_diff_count).toBe(0);
  });

  it("aceita produto inativo quando a regra de ativação o exige", () => {
    const audit = { ...validAudit, valid: [], placeholders: ["/produtos/placeholder-joia.svg"] };
    const result = compare(fixture(makeProduct({ images: ["/produtos/placeholder-joia.svg"] }), audit));
    expect(result.differences.some((difference) => difference.field === "inactive_by_migration")).toBe(true);
    expect(shadowMetrics(result).critical_diff_count).toBe(0);
  });

  it("trata produto sem imagem como inativo e sem metadado", () => {
    const audit = { ...validAudit, valid: [] };
    const result = compare(fixture(makeProduct({ images: [] }), audit));
    expect(result.images.equal).toBe(1);
    expect(result.images.legacyImages).toBe(0);
  });

  it("verifica source_type local, principal e sort_order", () => {
    const result = compare(fixture());
    expect(result.images).toMatchObject({ equal: 1, missing: 0, legacyImages: 1 });
  });

  it("exclui produto manual da comparação 1:1", () => {
    const result = compare(fixture());
    expect(result.adminOnlyCount).toBe(1);
    expect(result.manual.valid).toBe(true);
    expect(result.extraInDb).toEqual([]);
  });

  it("detecta alteração do produto manual contra o snapshot anterior", () => {
    const f = fixture();
    const result = compareStaticAndDatabaseCatalog([f.product], f.catalog, f.audits, {
      id: "manual-1", legacy_id: null, slug: "anel-feminino", name: "Nome anterior", is_active: true
    });
    expect(result.manual.valid).toBe(false);
  });

  it("preserva alianças como par com aros e benefícios", () => {
    const product = makeProduct({ category: "Alianças", subcategory: "Alianças Ouro 18k", description: "Gravação e caixinha inclusas." });
    const result = compare(fixture(product));
    expect(result.alliances).toMatchObject({ total: 1, soldAsPair: 1, withSizeRange: 1, engravingIncluded: 1, jewelryBoxIncluded: 1 });
  });

  it("usa somente o campo estruturado para is_custom_order", () => {
    const result = compare(fixture(makeProduct({ description: "Confeccionado sob encomenda.", isCustomOrder: false })));
    expect(shadowMetrics(result).critical_diff_count).toBe(0);
  });

  it("classifica descrição sob encomenda como made_to_order", () => {
    const f = fixture(makeProduct({ description: "Confeccionado sob encomenda." }));
    expect(f.row.stock_status).toBe("made_to_order");
    expect(f.row.is_custom_order).toBe(false);
  });

  it("classifica serviço como service", () => {
    const f = fixture(makeProduct({ category: "Serviços", subcategory: "Gravação", material: "Serviço técnico", stockStatus: "Serviço" }));
    expect(f.row.stock_status).toBe("service");
    expect(shadowMetrics(compare(f)).critical_diff_count).toBe(0);
  });

  it("preserva prioridade de indisponível sobre a descrição", () => {
    const f = fixture(makeProduct({ stockStatus: "Indisponível", description: "Sob encomenda." }));
    expect(f.row.stock_status).toBe("unavailable");
  });

  it("detecta material divergente", () => {
    const f = fixture(); f.row.material_id = "silver";
    expect(compare(f).taxonomy.materialDifferences).toBe(1);
  });

  it("detecta categoria divergente", () => {
    const f = fixture(); f.row.category_id = "alliances";
    expect(compare(f).taxonomy.categoryDifferences).toBe(1);
  });

  it("detecta subcategoria divergente", () => {
    const f = fixture(); f.row.subcategory_id = "gold-alliance";
    expect(compare(f).taxonomy.subcategoryDifferences).toBe(1);
  });

  it("lista produto ausente no banco", () => {
    const f = fixture(); f.catalog.products.shift();
    expect(compare(f).missingInDb).toEqual(["ring-1"]);
  });

  it("lista produto legado extra no banco", () => {
    const f = fixture(); f.catalog.products.push({ ...f.row, id: "extra", legacy_id: "extra", slug: "extra" });
    expect(compare(f).extraInDb).toEqual(["extra"]);
  });

  it("classifica diferença de preço como crítica", () => {
    const f = fixture(); f.row.price = "249.91";
    expect(compare(f).prices.divergent).toBe(1);
  });

  it("detecta diferença de old_price", () => {
    const f = fixture(makeProduct({ oldPrice: 399.9 })); f.row.old_price = "399.91";
    expect(compare(f).prices.divergent).toBe(1);
    expect(compare(f).differences.some((difference) => difference.field === "old_price" && difference.severity === "critical")).toBe(true);
  });

  it("detecta preço inesperado em produto sem preço", () => {
    const f = fixture(makeProduct({ price: null })); f.row.price = "1.00";
    expect(compare(f).prices).toMatchObject({ withoutPrice: 1, divergent: 1 });
  });

  it("detecta caminho ou metadado de imagem diferente", () => {
    const f = fixture(); f.catalog.images[0].path = "/produtos/outra.jpg";
    expect(compare(f).differences.some((difference) => difference.field === "images" && difference.severity === "critical")).toBe(true);
  });

  it("detecta imagem órfã", () => {
    const f = fixture(); f.catalog.images.push({ id: "orphan", product_id: "unknown", path: "lost.jpg", source_type: "local", is_primary: true, sort_order: 0 });
    expect(compare(f).differences.some((difference) => difference.field === "orphan_image")).toBe(true);
  });

  it("gera relatório com resumo, preços, imagens, alianças e taxonomia", () => {
    const report = renderShadowReport(compare(fixture()), "2026-09-22T00:00:00.000Z");
    expect(report).toContain("## Resumo");
    expect(report).toContain("## Preços");
    expect(report).toContain("## Imagens");
    expect(report).toContain("## Alianças");
    expect(report).toContain("## Taxonomia");
  });

  it("não modifica a resposta pública durante a comparação", () => {
    const publicProduct = getProductBySlug(products[0].slug);
    compare(fixture());
    expect(getProductBySlug(products[0].slug)).toBe(publicProduct);
    expect(publicProduct).toBe(products[0]);
  });
});
