import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
  productUpdate: vi.fn()
}));

vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: mocks.requireActiveAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { moveProductImageAction, setPrimaryImageAction } from "@/app/admin/(protected)/produtos/image-actions";

const productId = "00000000-0000-4000-8000-000000000001";
const firstId = "00000000-0000-4000-8000-000000000002";
const secondId = "00000000-0000-4000-8000-000000000003";
const images = [
  { id: firstId, product_id: productId, path: "product/first.jpg", source_type: "storage", sort_order: 0, is_primary: true, alt_text: "Frente" },
  { id: secondId, product_id: productId, path: "product/second.jpg", source_type: "storage", sort_order: 1, is_primary: false, alt_text: "Lateral" }
];

describe("admin image actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.productUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mocks.requireActiveAdmin.mockResolvedValue({
      supabase: {
        rpc: mocks.rpc,
        from: (table: string) => table === "ecommerce_product_images"
          ? {
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: images[1], error: null }) }),
                order: async () => ({ data: images, error: null }) })
            }),
            upsert: mocks.upsert
          }
          : { update: mocks.productUpdate }
      }
    });
  });

  it("troca principal exclusivamente pela RPC aprovada e invalida a vitrine", async () => {
    expect(await setPrimaryImageAction(productId, secondId)).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_set_product_primary_image", {
      p_product_id: productId,
      p_image_id: secondId
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("marjouxs-public-catalog");
  });

  it("reordena duas imagens em um único upsert, sem trocar o principal", async () => {
    expect(await moveProductImageAction(productId, secondId, "up")).toEqual({ ok: true });
    expect(mocks.upsert).toHaveBeenCalledWith([
      { ...images[1], sort_order: 0 },
      { ...images[0], sort_order: 1 }
    ], { onConflict: "id" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
