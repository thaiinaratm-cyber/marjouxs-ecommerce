import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CheckoutCatalogReadError,
  resolveAuthoritativeCheckoutCart,
  resolveAuthoritativeShipmentCart,
  type CheckoutCatalogSnapshot
} from "@/lib/checkout/catalog-server";
import {
  CheckoutConfigurationError,
  getCheckoutCatalogSource,
  isCheckoutCatalogFallbackEnabled
} from "@/lib/checkout/config";
import { getProductById } from "@/lib/checkout/catalog";
import type { CartLineInput } from "@/types/checkout";

const commonLine: CartLineInput = {
  productId: "brinco-ponto-de-luz",
  productSlug: "brinco-ponto-de-luz",
  quantity: 1,
  customization: null,
  displayedUnitPriceCents: 16000
};

function snapshot(
  row: Partial<CheckoutCatalogSnapshot["products"][number]> = {},
  categoryName = "Brincos"
): CheckoutCatalogSnapshot {
  return {
    products: [{
      id: "00000000-0000-4000-8000-000000000001",
      legacy_id: commonLine.productId,
      name: "Brinco Ponto de Luz",
      slug: commonLine.productSlug,
      category_id: "category-1",
      subcategory_id: "subcategory-1",
      material_id: "material-1",
      price: "160.00",
      stock_status: "available",
      sale_unit: "unit",
      is_active: true,
      engraving_available: false,
      size_min: null,
      size_max: null,
      ...row
    }],
    categories: [{ id: "category-1", name: categoryName, is_active: true }],
    subcategories: [{ id: "subcategory-1", category_id: "category-1", name: "Ouro 18k", is_active: true }],
    materials: [{ id: "material-1", name: "Ouro 18k", is_active: true }],
    images: [{
      product_id: "00000000-0000-4000-8000-000000000001",
      path: "/produtos/brinco-ponto-de-luz.jpg",
      source_type: "local",
      is_primary: true
    }]
  };
}

function databaseOptions(readDatabase: () => Promise<CheckoutCatalogSnapshot>, fallback = "true") {
  return {
    env: { CHECKOUT_CATALOG_SOURCE: "database", CHECKOUT_CATALOG_FALLBACK: fallback },
    readDatabase
  };
}

function allianceFixture(engravingAvailable = true) {
  const line: CartLineInput = {
    productId: "aliancas-em-ouro-18k-tradicional",
    productSlug: "aliancas-em-ouro-18k-tradicional",
    quantity: 1,
    displayedUnitPriceCents: 320000,
    customization: {
      type: "ring_pair",
      ring1: { size: 18, engraving: "João ♥ Maria" },
      ring2: { size: 15, engraving: "10/09/2026 ✨" }
    }
  };
  const data = snapshot({
    legacy_id: line.productId,
    slug: line.productSlug,
    name: "Alianças em Ouro 18k Tradicional",
    price: "3200.00",
    stock_status: "made_to_order",
    sale_unit: "pair",
    engraving_available: engravingAvailable,
    size_min: 8,
    size_max: 35
  }, "Alianças");
  return { line, data };
}

describe("catálogo autoritativo do checkout", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("mantém static como padrão, separado da fonte da vitrine", async () => {
    const readDatabase = vi.fn();
    const cart = await resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, displayedUnitPriceCents: 17990 }], "reject",
      { env: { PRODUCT_CATALOG_SOURCE: "database" }, readDatabase }
    );
    expect(cart.items[0].unitPriceCents).toBe(17990);
    expect(readDatabase).not.toHaveBeenCalled();
  });

  it.each(["development", "test", "production"])("respeita a configuração explícita em %s sem herdar flags da vitrine", (nodeEnv) => {
    const env = {
      NODE_ENV: nodeEnv,
      PRODUCT_CATALOG_SOURCE: "static",
      PRODUCT_CATALOG_FALLBACK: "true",
      CHECKOUT_CATALOG_SOURCE: "database",
      CHECKOUT_CATALOG_FALLBACK: "false"
    };
    expect(getCheckoutCatalogSource(env)).toBe("database");
    expect(isCheckoutCatalogFallbackEnabled(env)).toBe(false);
  });

  it("lê preço e dados comerciais do banco sem consultar o preço estático", async () => {
    const readDatabase = vi.fn().mockResolvedValue(snapshot());
    const cart = await resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(readDatabase)
    );
    expect(readDatabase).toHaveBeenCalledWith([commonLine.productId], [commonLine]);
    expect(cart.items[0]).toMatchObject({ unitPriceCents: 16000, subtotalCents: 16000 });
  });

  it("rejeita uma fonte de checkout inválida", async () => {
    await expect(resolveAuthoritativeCheckoutCart([commonLine], "reject", {
      env: { CHECKOUT_CATALOG_SOURCE: "unknown" }
    })).rejects.toBeInstanceOf(CheckoutConfigurationError);
  });

  it("bloqueia produto inativo mesmo que exista no catálogo estático", async () => {
    const readDatabase = vi.fn().mockResolvedValue(snapshot({ is_active: false }));
    await expect(resolveAuthoritativeCheckoutCart([commonLine], "reject", databaseOptions(readDatabase)))
      .rejects.toMatchObject({ code: "product_unavailable" });
    expect(readDatabase).toHaveBeenCalledTimes(1);
  });

  it("não usa fallback para produto inexistente e conserva o id após renomear slug", async () => {
    await expect(resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(async () => ({ ...snapshot(), products: [] }))
    )).rejects.toMatchObject({ code: "product_unavailable" });
    const cart = await resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(async () => snapshot({ slug: "slug-atualizado" }))
    );
    expect(cart.items[0].unitPriceCents).toBe(16000);
  });

  it("aceita produto manual ativo por UUID e bloqueia o mesmo produto inativo", async () => {
    const manualId = snapshot().products[0].id;
    const line = { ...commonLine, productId: manualId };
    const cart = await resolveAuthoritativeCheckoutCart(
      [line], "reject", databaseOptions(async () => snapshot({ legacy_id: null }))
    );
    expect(cart.items[0].unitPriceCents).toBe(16000);
    expect(cart.items[0].productId).toBe(manualId);
    await expect(resolveAuthoritativeCheckoutCart(
      [line], "reject", databaseOptions(async () => snapshot({ legacy_id: null, is_active: false }))
    )).rejects.toMatchObject({ code: "product_unavailable" });
  });

  it("bloqueia pagamento de produto sem preço", async () => {
    await expect(resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(async () => snapshot({ price: null }))
    )).rejects.toMatchObject({ code: "product_without_price" });
  });

  it("detecta preço adulterado de R$ 1 e informa o valor autoritativo de R$ 160", async () => {
    await expect(resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, displayedUnitPriceCents: 100 }],
      "reject", databaseOptions(async () => snapshot())
    )).rejects.toMatchObject({
      code: "price_changed",
      details: { productSlug: commonLine.productSlug, currentPriceCents: 16000 }
    });
  });

  it("usa R$ 3.600 do banco para o anel com pérola, nunca os R$ 990 do estático", async () => {
    const legacy = getProductById("anel-ouro-18k-com-perola")!;
    expect(legacy.price).toBe(990);
    const line: CartLineInput = {
      productId: legacy.id,
      productSlug: legacy.slug,
      quantity: 1,
      customization: null,
      displayedUnitPriceCents: 99000
    };
    const readDatabase = vi.fn().mockResolvedValue(snapshot({
      legacy_id: legacy.id,
      slug: legacy.slug,
      name: legacy.name,
      price: "3600.00"
    }, "Anéis"));
    const options = databaseOptions(readDatabase, "false");
    const review = await resolveAuthoritativeCheckoutCart([line], "report", options);
    expect(review.subtotalCents).toBe(360000);
    expect(review.priceChanges).toEqual([{ productSlug: legacy.slug, currentPriceCents: 360000 }]);
    await expect(resolveAuthoritativeCheckoutCart([line], "reject", options))
      .rejects.toMatchObject({ code: "price_changed", details: { currentPriceCents: 360000 } });
    const accepted = await resolveAuthoritativeCheckoutCart(
      [{ ...line, displayedUnitPriceCents: 360000 }], "reject", options
    );
    expect(accepted.items[0].unitPriceCents).toBe(360000);
    expect(accepted.subtotalCents).toBe(360000);
  });

  it.each(["category", "material", "subcategory"])("bloqueia taxonomia inválida de %s sem recorrer ao estático", async (field) => {
    const data = snapshot();
    if (field === "category") data.categories[0].is_active = false;
    if (field === "material") data.materials[0].is_active = false;
    if (field === "subcategory") data.subcategories[0].category_id = "other-category";
    await expect(resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(async () => data, "false")
    )).rejects.toMatchObject({ code: "product_unavailable" });
  });

  it("exige revisão quando um cliente antigo não informa o preço exibido", async () => {
    const oldLine = { ...commonLine };
    delete oldLine.displayedUnitPriceCents;
    await expect(resolveAuthoritativeCheckoutCart(
      [oldLine], "reject", databaseOptions(async () => snapshot())
    )).rejects.toMatchObject({
      code: "price_changed",
      details: { currentPriceCents: 16000 }
    });
  });

  it("informa mudança de preço na validação para revisão pelo cliente", async () => {
    const cart = await resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, displayedUnitPriceCents: 17990 }],
      "report", databaseOptions(async () => snapshot())
    );
    expect(cart.items[0].unitPriceCents).toBe(16000);
    expect(cart.priceChanges).toEqual([{ productSlug: commonLine.productSlug, currentPriceCents: 16000 }]);
  });

  it("mantém quantidade válida e total em centavos exatos", async () => {
    const cart = await resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, quantity: 2 }], "reject", databaseOptions(async () => snapshot())
    );
    expect(cart.subtotalCents).toBe(32000);
    await expect(resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, quantity: 0 }], "reject", databaseOptions(async () => snapshot())
    )).rejects.toMatchObject({ code: "invalid_quantity" });
  });

  it("converte numeric em centavos exatos e rejeita mais de duas casas não nulas", async () => {
    const cart = await resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, displayedUnitPriceCents: 16099 }], "reject",
      databaseOptions(async () => snapshot({ price: "160.99" }))
    );
    expect(cart.items[0].unitPriceCents).toBe(16099);
    await expect(resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(async () => snapshot({ price: "160.001" }))
    )).rejects.toMatchObject({ code: "invalid_catalog_price" });
  });

  it("preserva alianças por par, dois aros, gravação Unicode e preço do par", async () => {
    const { line, data } = allianceFixture();
    const cart = await resolveAuthoritativeCheckoutCart([line], "reject", databaseOptions(async () => data));
    expect(cart.subtotalCents).toBe(320000);
    expect(cart.items[0].quantity).toBe(1);
    expect(cart.items[0].customization).toEqual(line.customization);
    await expect(resolveAuthoritativeCheckoutCart(
      [{ ...line, customization: null }], "reject", databaseOptions(async () => data)
    )).rejects.toMatchObject({ code: "invalid_alliance_customization" });
    await expect(resolveAuthoritativeCheckoutCart(
      [{ ...line, quantity: 2 }], "reject", databaseOptions(async () => data)
    )).rejects.toMatchObject({ code: "invalid_alliance_quantity" });
  });

  it("rejeita aro fora de 8 a 35 e gravação não permitida", async () => {
    const { line, data } = allianceFixture();
    const invalidLine = {
      ...line,
      customization: { ...line.customization!, ring1: { size: 7, engraving: "João" } }
    } as CartLineInput;
    await expect(resolveAuthoritativeCheckoutCart(
      [invalidLine], "reject", databaseOptions(async () => data)
    )).rejects.toMatchObject({ code: "invalid_alliance_customization" });
    await expect(resolveAuthoritativeCheckoutCart(
      [line], "reject", databaseOptions(async () => allianceFixture(false).data)
    )).rejects.toMatchObject({ code: "unsupported_customization" });
  });

  it("impede personalização em produto comum", async () => {
    const { line } = allianceFixture();
    await expect(resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, customization: line.customization }], "reject",
      databaseOptions(async () => snapshot())
    )).rejects.toMatchObject({ code: "unsupported_customization" });
  });

  it("falha fechada em database mode mesmo se fallback estiver ligado", async () => {
    const readDatabase = vi.fn().mockRejectedValue(new Error("segredo não deve aparecer no log"));
    await expect(resolveAuthoritativeCheckoutCart(
      [{ ...commonLine, displayedUnitPriceCents: 17990 }],
      "reject", databaseOptions(readDatabase)
    )).rejects.toBeInstanceOf(CheckoutCatalogReadError);
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("segredo");
  });

  it("retorna erro técnico controlado sem fallback", async () => {
    await expect(resolveAuthoritativeCheckoutCart(
      [commonLine], "reject", databaseOptions(async () => { throw new Error("query failed"); }, "false")
    )).rejects.toBeInstanceOf(CheckoutCatalogReadError);
  });

  it("não ressuscita produto inativo nem preço estático na leitura usada pelo frete", async () => {
    const lines = [{ productId: commonLine.productId, productSlug: commonLine.productSlug, quantity: 1 }];
    await expect(resolveAuthoritativeShipmentCart(
      lines, databaseOptions(async () => snapshot({ is_active: false }), "false")
    )).rejects.toMatchObject({ code: "product_unavailable" });
    await expect(resolveAuthoritativeShipmentCart(
      lines, databaseOptions(async () => { throw new Error("database unavailable"); }, "false")
    )).rejects.toBeInstanceOf(CheckoutCatalogReadError);
  });

  it("usa preço atual do banco também para o valor segurado do frete", async () => {
    const shipment = await resolveAuthoritativeShipmentCart(
      [{ productId: commonLine.productId, productSlug: commonLine.productSlug, quantity: 2 }],
      databaseOptions(async () => snapshot())
    );
    expect(shipment.subtotalCents).toBe(32000);
  });
});
