import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ product: vi.fn(), related: vi.fn(), category: vi.fn(), rings: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/catalog", () => ({ getPublicProductBySlug: mocks.product, getPublicRelatedProducts: mocks.related,
  getPublicProductsByCategory: mocks.category, getPublicRingProducts: mocks.rings }));
vi.mock("@/components/product-purchase-actions", () => ({ ProductPurchaseActions: () => <button>Comprar agora</button> }));
import { products } from "@/data/products";
import ProductPage, { generateMetadata as productMetadata } from "@/app/produtos/[slug]/page";
import { generateMetadata as categoryMetadata } from "@/app/categorias/[slug]/page";
import { generateMetadata as ringMetadata } from "@/app/aneis/[material]/[[...tipo]]/page";
import { generateMetadata as productsMetadata } from "@/app/produtos/page";
import ConfirmationPage from "@/app/pedido/confirmacao/page";
import TrackingPage from "@/app/acompanhar-pedido/page";

const product = products.find(item => item.id === "brinco-ponto-de-luz")!;

describe("Next 15 asynchronous request props", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.product.mockResolvedValue(product);
    mocks.related.mockResolvedValue({ mode: "automatic", products: [] });
    mocks.category.mockResolvedValue([]);
    mocks.rings.mockResolvedValue([]);
  });
  it("awaits the product slug for metadata and preserves canonical/price source", async () => {
    const metadata = await productMetadata({ params: Promise.resolve({ slug: product.slug }) });
    expect(mocks.product).toHaveBeenCalledWith(product.slug);
    expect(metadata.alternates?.canonical).toBe(`https://marjouxsjoias.com.br/produtos/${product.slug}`);
    expect(metadata.title).toContain(product.name);
  });
  it("renders the product page after resolving params without changing its purchase action", async () => {
    const page = await ProductPage({ params: Promise.resolve({ slug: product.slug }) });
    const html = renderToStaticMarkup(page);
    expect(mocks.product).toHaveBeenCalledWith(product.slug);
    expect(mocks.related).toHaveBeenCalledWith(product, 4);
    expect(html).toContain(product.name);
    expect(html).toContain("Comprar agora");
  });
  it("awaits the category and subcategory before producing SEO", async () => {
    const metadata = await categoryMetadata({ params: Promise.resolve({ slug: "aliancas" }),
      searchParams: Promise.resolve({ subcategoria: "prata-950" }) });
    expect(mocks.category).toHaveBeenCalledWith("Alianças");
    expect(metadata.alternates?.canonical).toBe("https://marjouxsjoias.com.br/categorias/aliancas?subcategoria=prata-950");
  });
  it("awaits material and nested ring category before producing SEO", async () => {
    const metadata = await ringMetadata({ params: Promise.resolve({ material: "ouro-18k", tipo: ["perola"] }) });
    expect(mocks.rings).toHaveBeenCalledWith("ouro-18k", "perola");
    expect(metadata).toMatchObject({ alternates: { canonical: "https://marjouxsjoias.com.br/aneis/ouro-18k/perola" } });
  });
  it("preserves noindex for search/filter pages", async () => {
    const metadata = await productsMetadata({ searchParams: Promise.resolve({ busca: "ouro" }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
  it("passes only the resolved token to the existing confirmation component", async () => {
    const token = "00000000-0000-4000-8000-000000000099";
    expect((await ConfirmationPage({ searchParams: Promise.resolve({ token }) })).props).toEqual({ token });
  });
  it("renders the tracking lookup without identifiers in the URL", () => {
    const page = TrackingPage();
    expect(page.props).toEqual({});
    const html = renderToStaticMarkup(page);
    expect(html).toContain('method="post"');
    expect(html).toContain("Telefone usado na compra");
  });
});
