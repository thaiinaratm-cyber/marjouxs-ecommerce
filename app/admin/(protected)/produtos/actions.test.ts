import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  redirect: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn()
}));

vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: mocks.requireActiveAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { deactivateProductAction } from "@/app/admin/(protected)/produtos/actions";

const productId = "00000000-0000-4000-8000-000000000001";

function deactivationForm() {
  const formData = new FormData();
  formData.set("productId", productId);
  return formData;
}

describe("deactivateProductAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
    mocks.requireActiveAdmin.mockResolvedValue({ supabase: { from: mocks.from } });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ eq: mocks.eq, select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: productId }, error: null });
  });

  it("desativa apenas o produto ativo e invalida as páginas administrativas", async () => {
    await expect(deactivateProductAction(deactivationForm())).rejects.toThrow(
      `redirect:/admin/produtos/${productId}?deactivated=1`
    );

    expect(mocks.requireActiveAdmin).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("ecommerce_products");
    expect(mocks.update).toHaveBeenCalledWith({ is_active: false });
    expect(mocks.eq).toHaveBeenCalledWith("id", productId);
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.select).toHaveBeenCalledWith("id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/produtos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/produtos/${productId}`);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("marjouxs-public-catalog");
  });

  it("não confirma a desativação quando nenhum registro foi atualizado", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(deactivateProductAction(deactivationForm())).rejects.toThrow(
      `redirect:/admin/produtos/${productId}?error=deactivation`
    );

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
