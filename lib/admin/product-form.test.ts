import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  parseAdminProductForm,
  parseBrazilianPrice,
  toProductSlug,
  validateProductActivation,
  validateProductImage
} from "@/lib/admin/product-form";

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const MATERIAL_ID = "22222222-2222-4222-8222-222222222222";

function technicalForm() {
  const form = new FormData();
  form.set("name", "Peça de teste");
  form.set("slug", "peca-de-teste");
  form.set("categoryId", CATEGORY_ID);
  form.set("materialId", MATERIAL_ID);
  return form;
}

describe("admin product form", () => {
  it.each([
    ["name", "Nome do produto é obrigatório."], ["slug", "Slug é obrigatório."],
    ["categoryId", "Selecione uma categoria."], ["materialId", "Selecione um material."]
  ])("identifica campo obrigatório vazio: %s", (field, message) => {
    const form = technicalForm(); form.set(field, "");
    expect(parseAdminProductForm(form)).toMatchObject({ success: false, fieldErrors: { [field]: message } });
  });
  it.each(["Pulseira", "Corrente"])("aceita rascunho mínimo de %s sem gravação ou técnicos", (name) => {
    const form = technicalForm(); form.set("name", name);
    const result = parseAdminProductForm(form);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ price: null, installmentsCount: null,
      engravingAvailable: false, engravingIncluded: false });
  });
  it("normaliza gravação inclusa sem disponibilidade sem causar erro", () => {
    const form = technicalForm(); form.set("engravingIncluded", "on");
    const result = parseAdminProductForm(form);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.engravingIncluded).toBe(false);
  });
  it("normaliza slug com acentos", () => {
    expect(toProductSlug("Anel Pérola Coração 18k")).toBe("anel-perola-coracao-18k");
  });

  it.each([
    ["R$ 3.080,00", "3080.00"],
    ["990,5", "990.50"],
    ["12780", "12780.00"],
    ["", null]
  ])("converte preço brasileiro sem ponto flutuante (%s)", (input, expected) => {
    expect(parseBrazilianPrice(input)).toBe(expected);
  });

  it("rejeita preço inválido ou zero", () => {
    expect(parseBrazilianPrice("12,345")).toBeUndefined();
    expect(parseBrazilianPrice("0")).toBeUndefined();
  });

  it("sempre produz dados para um rascunho sem campo is_active", () => {
    const formData = new FormData();
    formData.set("name", "Anel de teste seguro");
    formData.set("slug", "anel-de-teste-seguro");
    formData.set("categoryId", CATEGORY_ID);
    formData.set("subcategoryId", "");
    formData.set("materialId", MATERIAL_ID);
    formData.set("price", "990,00");
    formData.set("shortDescription", "Produto novo para validação.");
    formData.set("description", "Descrição de teste.");
    formData.set("stockStatus", "available");
    formData.set("saleUnit", "unit");

    const result = parseAdminProductForm(formData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe("990.00");
      expect(result.data.subcategoryId).toBeNull();
      expect(result.data).not.toHaveProperty("is_active");
    }
  });
});

describe("admin product image and activation validation", () => {
  it("aceita apenas os formatos e o limite aprovados", () => {
    expect(validateProductImage({ type: "image/webp", size: MAX_PRODUCT_IMAGE_BYTES })).toBeNull();
    expect(validateProductImage({ type: "image/gif", size: 1000 })).toBe("invalid_type");
    expect(validateProductImage({ type: "image/jpeg", size: MAX_PRODUCT_IMAGE_BYTES + 1 })).toBe("invalid_size");
  });

  it("bloqueia ativação sem imagem principal", () => {
    const product = {
      name: "Anel Ouro 18k",
      slug: "anel-ouro-18k",
      category_id: CATEGORY_ID,
      material_id: MATERIAL_ID
    };

    expect(validateProductActivation(product, false)).toBe("primary_image_required");
    expect(validateProductActivation(product, true)).toBeNull();
  });

  it("bloqueia ativação de cadastro incompleto mesmo com imagem", () => {
    expect(validateProductActivation({ name: "", slug: "produto" }, true)).toBe("incomplete_product");
  });
});
