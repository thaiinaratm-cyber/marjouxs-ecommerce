import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin/revalidate", () => ({ revalidateAdminProduct: vi.fn() }));

import { createDraftProductAction, updateProductAction } from "@/app/admin/(protected)/produtos/actions";

const id = "00000000-0000-4000-8000-000000000001";
function query(data: unknown, error: { code: string } | null = null) {
  const result = {
    select: () => result, eq: () => result,
    maybeSingle: async () => ({ data, error }),
    single: async () => ({ data, error })
  };
  return result;
}
function form() {
  const data = new FormData();
  data.set("productId", id);
  data.set("version", "1");
  data.set("name", "Peça de teste");
  data.set("slug", "peca-de-teste");
  data.set("categoryId", "11111111-1111-4111-8111-111111111111");
  data.set("materialId", "22222222-2222-4222-8222-222222222222");
  return data;
}

describe("validação e persistência do formulário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((url: string) => { throw Error(`redirect:${url}`); });
    mocks.auth.mockResolvedValue({ supabase: { from: mocks.from } });
    mocks.insert.mockImplementation(() => query({ id }));
    mocks.update.mockImplementation(() => query({ id }));
    mocks.from.mockImplementation((table: string) => table === "ecommerce_products"
      ? { ...query({ id, is_active: false }), insert: mocks.insert, update: mocks.update }
      : query({ id, name: "Alianças", is_active: true }));
  });

  it("cria rascunho sem gravação nem campos opcionais", async () => {
    await expect(createDraftProductAction(form())).resolves.toEqual({ redirectTo: `/admin/produtos/${id}?created=1` });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, price: null, engraving_available: false, engraving_included: false }));
  });

  it("retorna a URL direta após editar", async () => {
    await expect(updateProductAction(form())).resolves.toEqual({ redirectTo: `/admin/produtos/${id}?saved=1` });
  });

  it("retorna erro específico sem redirecionar nem gravar e preserva o formulário", async () => {
    const data = form(); data.set("name", ""); data.set("description", "Texto preservado");
    expect(await createDraftProductAction(data)).toMatchObject({ fieldErrors: { name: "Nome do produto é obrigatório." } });
    expect(data.get("description")).toBe("Texto preservado");
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each([createDraftProductAction, updateProductAction])("retorna colisão somente no campo slug", async (action) => {
    const failed = () => query(null, { code: "23505" });
    mocks.insert.mockImplementation(failed); mocks.update.mockImplementation(failed);
    expect(await action(form())).toEqual({ message: "Revise o slug.", fieldErrors: { slug: "Este slug já está sendo utilizado por outro produto." } });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
