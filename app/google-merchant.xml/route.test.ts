import { afterEach, describe, expect, it, vi } from "vitest";
import { products } from "@/data/products";
import { GET } from "./route";
import { getVisibleProducts } from "@/lib/products";

vi.mock("@/lib/products", () => ({ getVisibleProducts: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("GET /google-merchant.xml", () => {
  it("consulta a fonte pública a cada chamada e entrega XML sem autenticação", async () => {
    vi.stubEnv("MERCHANT_PRODUCT_IMAGES", JSON.stringify(products.flatMap((product) => product.images)));
    vi.mocked(getVisibleProducts).mockReturnValue(products);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("<g:identifier_exists>false</g:identifier_exists>");
    await GET();
    expect(getVisibleProducts).toHaveBeenCalledTimes(2);
  });

  it("retorna 503 sem vazar detalhes internos em falha de leitura", async () => {
    vi.stubEnv("MERCHANT_PRODUCT_IMAGES", "[]");
    vi.mocked(getVisibleProducts).mockImplementation(() => { throw new Error("internal-secret-database-token"); });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Feed temporariamente indisponível.");
    expect(response.headers.get("retry-after")).toBe("300");
  });

  it("não publica catálogo vazio se não houver produtos ou inventário de imagens", async () => {
    vi.stubEnv("MERCHANT_PRODUCT_IMAGES", "[]");
    vi.mocked(getVisibleProducts).mockReturnValue(products);
    expect((await GET()).status).toBe(503);
    vi.stubEnv("MERCHANT_PRODUCT_IMAGES", JSON.stringify(products.flatMap((product) => product.images)));
    vi.mocked(getVisibleProducts).mockReturnValue([]);
    expect((await GET()).status).toBe(503);
  });
});
