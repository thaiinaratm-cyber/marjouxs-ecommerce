import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { products } from "@/data/products";
import { formatCurrency } from "@/lib/format";
import type { ValidatedCart } from "@/types/checkout";

const renderState = vi.hoisted(() => ({
  hookIndex: 0,
  accepted: false,
  cart: null as unknown,
  validatedCart: null as unknown
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: <T,>(initial: T | (() => T)) => {
      const index = renderState.hookIndex++;
      if (index === 0) return react.useState(renderState.validatedCart);
      if (index === 14) return react.useState(renderState.accepted);
      return react.useState(initial);
    }
  };
});

vi.mock("@/context/cart-context", () => ({ useCart: () => renderState.cart }));
vi.mock("@/components/product-image", () => ({
  ProductImage: () => <span aria-hidden="true" />
}));

import CheckoutPage from "@/app/checkout/page";

const product = products.find((item) => item.id === "anel-solitario-prata-950")!;
const line = {
  lineId: "test-line",
  productId: product.id,
  productSlug: product.slug,
  quantity: 1,
  customization: null
};
const validatedCart: ValidatedCart = {
  items: [{
    productId: product.id,
    productSlug: product.slug,
    name: product.name,
    image: product.images[0],
    category: product.category,
    subcategory: product.subcategory,
    material: product.material,
    availability: "Disponível",
    unitPriceCents: 16000,
    quantity: 1,
    subtotalCents: 16000,
    customization: null
  }],
  subtotalCents: 16000,
  priceChanges: [{ productSlug: product.slug, currentPriceCents: 16000 }]
};

function renderCheckout(accepted: boolean) {
  vi.stubGlobal("React", React);
  renderState.hookIndex = 0;
  renderState.accepted = accepted;
  renderState.validatedCart = validatedCart;
  renderState.cart = { items: [{ ...line, product }], lines: [line], isReady: true };
  return renderToStaticMarkup(<CheckoutPage />);
}

describe("checkout price review HTML", () => {
  beforeEach(() => { renderState.hookIndex = 0; });
  afterEach(() => vi.unstubAllGlobals());

  it("mostra o preço atualizado e bloqueia pagamento antes da confirmação", () => {
    const html = renderCheckout(false);
    expect(html).toContain("O preço de um produto mudou.");
    expect(html).toContain(formatCurrency(160));
    expect(html).toContain("Confirmar preços atualizados");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("libera o botão só após a confirmação sem alterar o resumo", () => {
    const html = renderCheckout(true);
    expect(html).not.toContain("Confirmar preços atualizados");
    expect(html).toContain(formatCurrency(160));
    expect(html).toMatch(/<button[^>]*type="submit"/);
    expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});
