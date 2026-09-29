import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { products } from "@/data/products";
import {
  readCheckoutDatabaseProducts,
  resolveAuthoritativeCheckoutCart
} from "@/lib/checkout/catalog-server";
import type { CartLineInput } from "@/types/checkout";

const hasServerCredentials = Boolean(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY
);
const originalSupabaseUrl = process.env.SUPABASE_URL;

describe.skipIf(!hasServerCredentials)("checkout Supabase real (somente leitura)", () => {
  beforeAll(() => { process.env.SUPABASE_URL ||= process.env.NEXT_PUBLIC_SUPABASE_URL; });
  afterAll(() => {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
  });

  it("usa o leitor real do checkout e bloqueia inativo antes do fallback", async () => {
    const env = { CHECKOUT_CATALOG_SOURCE: "database", CHECKOUT_CATALOG_FALLBACK: "true" };
    const cart = await resolveAuthoritativeCheckoutCart([{
      productId: "anel-solitario-prata-950",
      productSlug: "anel-solitario-prata-950",
      quantity: 1,
      customization: null,
      displayedUnitPriceCents: 16000
    }], "reject", { env });
    expect(cart.items[0].unitPriceCents).toBe(16000);

    await expect(resolveAuthoritativeCheckoutCart([{
      productId: "aliancas-em-ouro-18k-anatomicas",
      productSlug: "aliancas-em-ouro-18k-anatomicas",
      quantity: 1,
      customization: { type: "ring_pair", ring1: { size: 18 }, ring2: { size: 16 } },
      displayedUnitPriceCents: 0
    }], "reject", { env })).rejects.toMatchObject({ code: "product_unavailable" });
  }, 30000);

  it("consulta anel de prata, alianças de prata e ouro e bloqueia legados inativos", async () => {
    const ids = [
      "anel-solitario-prata-950",
      "combo-aliancas-prata-950-anel-solitario",
      "aliancas-em-ouro-18k-tradicional",
      "aliancas-em-ouro-18k-anatomicas"
    ];
    const snapshot = await readCheckoutDatabaseProducts(ids);
    expect(snapshot.products).toHaveLength(4);
    const readDatabase = async () => snapshot;
    const env = { CHECKOUT_CATALOG_SOURCE: "database", CHECKOUT_CATALOG_FALLBACK: "false" };

    for (const id of ids.slice(0, 3)) {
      const product = products.find((candidate) => candidate.id === id)!;
      const line: CartLineInput = {
        productId: id,
        productSlug: product.slug,
        quantity: 1,
        displayedUnitPriceCents: Number(snapshot.products.find((row) => row.legacy_id === id)?.price) * 100,
        customization: product.category === "Alianças"
          ? { type: "ring_pair", ring1: { size: 18 }, ring2: { size: 16 } }
          : null
      };
      const cart = await resolveAuthoritativeCheckoutCart([line], "reject", { env, readDatabase });
      expect(cart.subtotalCents).toBeGreaterThan(0);
      expect(cart.items[0].productId).toBe(id);
      if (product.category === "Alianças") expect(cart.items[0].quantity).toBe(1);
    }

    await expect(resolveAuthoritativeCheckoutCart([{
      productId: ids[3], productSlug: ids[3], quantity: 1,
      customization: { type: "ring_pair", ring1: { size: 18 }, ring2: { size: 16 } }
    }], "reject", { env, readDatabase })).rejects.toMatchObject({ code: "product_unavailable" });
  }, 30000);

  it("não libera produto ativo sem preço nem produto manual", async () => {
    const ids = products.filter((product) => product.price === null).map((product) => product.id);
    const snapshot = await readCheckoutDatabaseProducts(ids);
    const withoutPrice = snapshot.products.find((row) => row.is_active && row.price === null);
    expect(withoutPrice).toBeDefined();
    const env = { CHECKOUT_CATALOG_SOURCE: "database", CHECKOUT_CATALOG_FALLBACK: "true" };
    await expect(resolveAuthoritativeCheckoutCart([{
      productId: withoutPrice!.legacy_id!,
      productSlug: withoutPrice!.slug,
      quantity: 1,
      customization: withoutPrice!.sale_unit === "pair"
        ? { type: "ring_pair", ring1: { size: 18 }, ring2: { size: 16 } }
        : null
    }], "reject", { env, readDatabase: async () => snapshot }))
      .rejects.toMatchObject({ code: "product_without_price" });

    const manual = await readCheckoutDatabaseProducts(["anel-feminino"]);
    expect(manual.products).toHaveLength(0);
    await expect(resolveAuthoritativeCheckoutCart([{
      productId: "anel-feminino", productSlug: "anel-feminino", quantity: 1, customization: null
    }], "reject", { env, readDatabase: async () => manual }))
      .rejects.toMatchObject({ code: "product_unavailable" });
  }, 30000);
});
