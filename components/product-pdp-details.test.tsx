import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCharacteristics } from "@/components/product-characteristics";
import { ProductDescription } from "@/components/product-description";
import { ProductFaq } from "@/components/product-faq";
import { ProductTrustBlock } from "@/components/product-commercial-info";
import { ProductPrice } from "@/components/product-price";
import { ProductPurchaseActions } from "@/components/product-purchase-actions";
import type { Product } from "@/types/product";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("@/context/cart-context", () => ({ useCart: () => ({ addItem: vi.fn() }) }));

const product: Product = {
  id: "pdp-qa", name: "Anel QA", slug: "anel-qa", category: "Anéis", subcategory: "",
  material: "Ouro 18k", price: 160, priceLabel: "R$ 160,00", installments: "",
  description: "", images: [], featured: false, isCustomOrder: false,
  allowWhatsappQuote: true, stockStatus: "Disponível"
};

describe("detalhes da PDP", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());

  it("mostra peso comercial e medidas nas unidades cadastradas", () => {
    const html = renderToStaticMarkup(<ProductCharacteristics product={{
      ...product, technicalDetails: { weightGrams: 4.125, widthMm: 4, lengthCm: 18 }
    }} />);
    expect(html).toContain("Peso aproximado");
    expect(html).toContain("4,125 g");
    expect(html).toContain("Largura");
    expect(html).toContain("4 mm");
    expect(html).toContain("18 cm");
    expect(html).not.toContain("3 a 5 dias úteis");
    expect(html).not.toMatch(/frete|transporte/i);
  });

  it("omite campos sem valor, marcadores e a escolha de pedra em um produto normal", () => {
    const item = { ...product, technicalDetails: { finish: "Não informado" } };
    const html = renderToStaticMarkup(<>
      <ProductPurchaseActions product={item} whatsappUrl="https://example.invalid" />
      <ProductCharacteristics product={item} />
    </>);
    expect(html).not.toMatch(/Peso aproximado|Largura|Acabamento|Escolha a cor da pedra/);
    expect(html).toContain("Material");
  });

  it("mantém características disponíveis no produto sob orçamento, sem compra direta", () => {
    const item = { ...product, price: null, priceLabel: "Preço sob consulta", technicalDetails: { widthMm: 4 } };
    const html = renderToStaticMarkup(<>
      <ProductPrice product={item} />
      <ProductPurchaseActions product={item} whatsappUrl="https://wa.me/5500000000000" />
      <ProductCharacteristics product={item} />
    </>);
    expect(html).toContain("Preço sob consulta");
    expect(html).toContain("Solicitar orçamento no WhatsApp");
    expect(html).toContain("4 mm");
    expect(html).not.toMatch(/Comprar agora|12x|Pix/);
  });

  it("separa produção de transporte perto da compra sem inventar prazo de orçamento", () => {
    const html = renderToStaticMarkup(<ProductTrustBlock product={product} />);
    expect(html).toContain("Produção: 3 a 5 dias úteis");
    expect(html).toContain("prazo de transporte é informado à parte");
    expect(html).toContain('href="/politica-de-entrega"');
    expect(renderToStaticMarkup(<ProductTrustBlock product={{ ...product, price: null }} />)).not.toContain("3 a 5 dias úteis");
  });

  it("usa accordion nativo com links reais e oculta o FAQ quando não há perguntas", () => {
    const html = renderToStaticMarkup(<ProductFaq product={{ ...product, category: "Alianças", engravingAvailable: true }} />);
    expect(html.match(/<summary/g)).toHaveLength(3);
    expect(html).toContain('href="/guia-de-tamanhos"');
    expect(html).toContain('href="/garantia-e-trocas"');
    expect(html).not.toContain("cor da pedra");
    expect(renderToStaticMarkup(<ProductFaq product={{ ...product, category: "Serviços" }} />)).toBe("");
  });

  it("mostra somente os aros disponíveis e não oferece gravação explicitamente desabilitada", () => {
    const html = renderToStaticMarkup(<ProductPurchaseActions product={{
      ...product, category: "Alianças", sizeMin: 12, sizeMax: 21, engravingAvailable: false
    }} whatsappUrl="https://example.invalid" />);
    expect(html).toContain("Aro 12");
    expect(html).toContain("Aro 21");
    expect(html).not.toMatch(/Aro 11|Aro 22|Gravação opcional/);
  });

  it("renderiza títulos e negrito sem um segundo H1", () => {
    const html = renderToStaticMarkup(<ProductDescription description={"### Detalhes\n\n**Material:** Prata 950\n\n- Item"} />);
    expect(html).toMatch(/<h3[^>]*>Detalhes<\/h3>/);
    expect(html).toContain("<strong>Material:</strong> Prata 950");
    expect(html).toContain("<li>Item</li>");
    expect(html).not.toMatch(/###|\*\*|<h1/);
  });

  it("bloqueia HTML cru e destinos inseguros, preservando links seguros", () => {
    const description = [
      "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<a href='https://example.invalid' onclick='evil()'>HTML</a>",
      "[JS](javascript:alert%281%29) [dados](data:text/html,x) [remoto](//example.invalid) [Loja](/contato)",
      "[Seguro](https://example.invalid/guia)"
    ].join("\n\n");
    const html = renderToStaticMarkup(<ProductDescription description={description} />);
    expect(html).toContain('href="/contato"');
    expect(html).toContain('href="https://example.invalid/guia"');
    expect(html).not.toMatch(/<script|<img|onerror|onclick|href="(?:javascript:|data:|\/\/)/i);
  });
});
