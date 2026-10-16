import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseCatalog } from "@/lib/catalog/database-products";

const mocks = vi.hoisted(() => ({ read: vi.fn(), cache: new Map<string, unknown>() }));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/supabase/config", () => ({ getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", anonKey: "test" }) }));
vi.mock("@/lib/catalog/database-products", () => ({ readPublicDatabaseCatalog: mocks.read }));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(), revalidatePath: vi.fn(),
  revalidateTag: () => mocks.cache.clear(),
  unstable_cache: (fn: () => Promise<unknown>, keys: string[]) => async () => {
    const key = keys.join();
    if (!mocks.cache.has(key)) mocks.cache.set(key, await fn());
    return mocks.cache.get(key);
  }
}));

import { getPublicProductBySlug, getPublicProducts, getPublicProductsByCategory, searchPublicProducts } from "@/lib/catalog";
import { revalidateAdminProduct } from "@/lib/admin/revalidate";

function fixture(active: boolean): DatabaseCatalog {
  const catalog: DatabaseCatalog = {
    products: [{ id: "manual-id", legacy_id: null, name: "Pulseira Cartier Oca 4mm", slug: "pulseira-cartier-oca-4mm",
      category_id: "bracelets", subcategory_id: "gold-bracelets", material_id: "gold", price: 6000,
      old_price: null, discount_percent: null, cash_discount_percent: null, installments_count: 12,
      price_label_override: null, installments_text_override: null, description: "Pulseira em ouro", tags: [],
      stock_status: "available", sale_unit: "unit", is_custom_order: false, is_active: active,
      is_featured: false, allow_whatsapp_quote: true, engraving_available: false, engraving_included: false,
      jewelry_box_included: false, size_min: null, size_max: null }],
    images: [{ id: "image", product_id: "manual-id", source_type: "storage", path: "manual/model.webp", is_primary: true, sort_order: 0 }],
    categories: [{ id: "bracelets", name: "Pulseiras", slug: "pulseiras", is_active: true }],
    subcategories: [{ id: "gold-bracelets", category_id: "bracelets", name: "Pulseiras em Ouro", slug: "ouro", is_active: true }],
    materials: [{ id: "gold", name: "Ouro 18k", slug: "ouro-18k", is_active: true }]
  };
  catalog.products.push({ ...catalog.products[0], id: "baseline", slug: "modelo-base", name: "Modelo Base", description: "Peça", is_active: true });
  catalog.images.push({ ...catalog.images[0], id: "baseline-image", product_id: "baseline" });
  return catalog;
}

describe("publicação admin e cache da vitrine", () => {
  beforeEach(() => {
    mocks.cache.clear(); mocks.read.mockReset();
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PRODUCT_CATALOG_SOURCE", "database");
    vi.stubEnv("PRODUCT_CATALOG_FALLBACK", "false");
  });
  it("encontra admin-only ativo por slug, categoria, listagem e todos os termos de busca", async () => {
    mocks.read.mockResolvedValue(fixture(true));
    expect(await getPublicProductBySlug("pulseira-cartier-oca-4mm")).toMatchObject({ id: "manual-id", price: 6000 });
    expect(await getPublicProducts()).toHaveLength(2);
    expect(await getPublicProductsByCategory("Pulseiras")).toHaveLength(2);
    for (const term of ["pulseira", "pulseira cart", "cartier", "oca 4mm"]) expect((await searchPublicProducts(term)).some((item) => item.id === "manual-id")).toBe(true);
  });
  it("publicação e desativação invalidam o cache compartilhado sem reiniciar processo", async () => {
    mocks.read.mockResolvedValue(fixture(false));
    expect(await getPublicProducts()).toHaveLength(1);
    mocks.read.mockResolvedValue(fixture(true));
    revalidateAdminProduct("manual-id");
    expect(await getPublicProductBySlug("pulseira-cartier-oca-4mm")).toBeDefined();
    expect(await searchPublicProducts("cartier")).toHaveLength(1);
    mocks.read.mockResolvedValue(fixture(false));
    revalidateAdminProduct("manual-id");
    expect(await getPublicProductBySlug("pulseira-cartier-oca-4mm")).toBeUndefined();
    expect(await searchPublicProducts("cartier")).toHaveLength(0);
  });
  it("em desenvolvimento lê alterações entre requisições sem cache persistente", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.read.mockResolvedValue(fixture(false)); expect(await getPublicProducts()).toHaveLength(1);
    mocks.read.mockResolvedValue(fixture(true)); expect(await getPublicProducts()).toHaveLength(2);
    mocks.read.mockResolvedValue(fixture(false)); expect(await getPublicProducts()).toHaveLength(1);
  });
});
