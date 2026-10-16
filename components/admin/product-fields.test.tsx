import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ProductFields } from "@/components/admin/product-fields";
import type { AdminTaxonomy } from "@/lib/admin/catalog";

const taxonomy: AdminTaxonomy = {
  categories: ["Alianças", "Correntes", "Pulseiras", "Brincos"].map((name) => ({ id: name, name, slug: name, is_active: true })),
  subcategories: [], materials: []
};

describe("validação inline no admin", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  it("renderiza erro inline mantendo os valores digitados", () => {
    const html = renderToStaticMarkup(<ProductFields taxonomy={taxonomy} values={{ name: "Pulseira preservada", slug: "slug-existente", description: "Descrição preservada", price: "6000" }} fieldErrors={{ slug: "Este slug já está sendo utilizado por outro produto." }} />);
    expect(html).toContain('id="error-slug"');
    expect(html).toContain("Este slug já está sendo utilizado por outro produto.");
    expect(html).toContain('value="Pulseira preservada"'); expect(html).toContain('value="6000"');
    expect(html).toContain("Descrição preservada");
  });
  it("desabilita gravação inclusa se gravação não estiver disponível", () => {
    const html = renderToStaticMarkup(<ProductFields taxonomy={taxonomy} values={{ engravingAvailable: false, engravingIncluded: true }} />);
    const input = html.match(/<input[^>]*name="engravingIncluded"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('disabled=""'); expect(input).not.toContain('checked=""');
  });
});
