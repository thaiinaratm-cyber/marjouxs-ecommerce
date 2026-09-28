import { stat } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import { readPublicDatabaseCatalog } from "@/lib/catalog/database-products";
import { normalizePublicDatabaseCatalog } from "@/lib/catalog/normalize-public";
import { getVisibleProducts } from "@/lib/products";
import { getProductById } from "@/lib/checkout/catalog";

const hasPublicCredentials = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

describe.skipIf(!hasPublicCredentials)("catálogo público real (somente leitura)", () => {
  it("lê somente os 387 legados ativos e mantém paridade de compra e imagens", async () => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const database = await readPublicDatabaseCatalog(client);
    const publicProducts = normalizePublicDatabaseCatalog(database, products);

    expect(database.products).toHaveLength(387);
    expect(publicProducts).toHaveLength(387);
    expect(getVisibleProducts()).toHaveLength(387);
    expect(publicProducts.every((product) => product.id === getProductById(product.id)?.id)).toBe(true);
    expect(publicProducts.every((product) => product.price === getProductById(product.id)?.price &&
      product.slug === getProductById(product.id)?.slug)).toBe(true);
    expect(publicProducts.some((product) => product.slug === "anel-feminino")).toBe(false);
    expect(publicProducts.some((product) => product.slug === "aliancas-em-ouro-18k-anatomicas")).toBe(false);
    expect(publicProducts.filter((product) => product.price === null)).toHaveLength(1);
    expect(products.filter((product) => product.price === null)).toHaveLength(4);
    expect(publicProducts.filter((product) => product.category === "Alianças")).toHaveLength(141);
    expect(publicProducts.filter((product) => product.category === "Alianças").every((product) =>
      product.saleUnit === "pair" && product.sizeMin === 8 && product.sizeMax === 35
    )).toBe(true);

    for (const product of publicProducts) {
      for (const image of product.images) {
        const file = path.join(process.cwd(), "public", image.slice(1));
        expect((await stat(file)).isFile()).toBe(true);
      }
    }
  }, 30000);
});
