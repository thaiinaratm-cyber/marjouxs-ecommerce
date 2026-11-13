import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutConfigurationError, getPublicSiteUrl, getShippingConfiguration } from "@/lib/checkout/config";

afterEach(() => vi.unstubAllEnvs());

function shippingEnvironment() {
  vi.stubEnv("MELHOR_ENVIO_USER_AGENT", "Marjouxs QA");
  vi.stubEnv("MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS", "2");
  for (const key of ["DEFAULT_SHIPMENT_WEIGHT_KG", "DEFAULT_SHIPMENT_LENGTH_CM", "DEFAULT_SHIPMENT_WIDTH_CM", "DEFAULT_SHIPMENT_HEIGHT_CM"]) {
    vi.stubEnv(key, undefined);
  }
}

describe("real shipment package configuration", () => {
  it("uses the measured 16 x 11 x 3 cm and 70 g package as defaults", () => {
    shippingEnvironment();
    const shipment = getShippingConfiguration().package;
    expect(shipment).toEqual({ lengthCm: 16, widthCm: 11, heightCm: 3, weightKg: 0.07 });
    expect(shipment.weightKg).toBe(70 / 1000);
    expect(shipment.weightKg * 1000).toBe(70);
    for (const wrongUnit of [0.7, 7, 70]) expect(shipment.weightKg).not.toBe(wrongUnit);
  });
  it("reads the approved kg/cm values from environment without converting them again", () => {
    shippingEnvironment();
    vi.stubEnv("DEFAULT_SHIPMENT_LENGTH_CM", "16");
    vi.stubEnv("DEFAULT_SHIPMENT_WIDTH_CM", "11");
    vi.stubEnv("DEFAULT_SHIPMENT_HEIGHT_CM", "3");
    vi.stubEnv("DEFAULT_SHIPMENT_WEIGHT_KG", "0.07");
    expect(getShippingConfiguration().package).toEqual({ lengthCm: 16, widthCm: 11, heightCm: 3, weightKg: 0.07 });
  });
  it("preserves explicit environment overrides instead of hardcoding every package", () => {
    shippingEnvironment();
    vi.stubEnv("DEFAULT_SHIPMENT_WEIGHT_KG", "0.12");
    vi.stubEnv("DEFAULT_SHIPMENT_LENGTH_CM", "17");
    vi.stubEnv("DEFAULT_SHIPMENT_WIDTH_CM", "13");
    vi.stubEnv("DEFAULT_SHIPMENT_HEIGHT_CM", "4");
    expect(getShippingConfiguration().package).toEqual({ weightKg: 0.12, lengthCm: 17, widthCm: 13, heightCm: 4 });
  });
});

describe("checkout public site origin", () => {
  it.each([
    "https://marjouxsjoias.com.br",
    "https://marjouxsjoias.com.br/",
    " https://marjouxsjoias.com.br/ ",
    "https://marjouxsjoias.com.br:443"
  ])("normalizes the canonical production origin: %s", value => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    expect(getPublicSiteUrl("http://localhost:3000")).toBe("https://marjouxsjoias.com.br");
  });

  it.each([
    "http://marjouxsjoias.com.br",
    "http://localhost:3000",
    "https://localhost",
    "http://127.0.0.1:3000",
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://192.168.0.1",
    "https://[::1]",
    "https://www.marjouxsjoias.com.br",
    "https://marjouxsjoias.com.br.evil.test",
    "https://evil.test/marjouxsjoias.com.br",
    "https://marjouxsjoias.com.br@evil.test",
    "https://private-user:private-password@marjouxsjoias.com.br",
    "https://marjouxsjoias.com.br:444",
    "https://marjouxsjoias.com.br./",
    "https://marjouxsjoias.com.br/subpath",
    "https://marjouxsjoias.com.br?next=private-value",
    "https://marjouxsjoias.com.br#private-value",
    "ftp://marjouxsjoias.com.br",
    "not a URL",
    "",
    "   "
  ])("fails closed for an invalid production origin: %s", value => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    let error: unknown;
    try { getPublicSiteUrl("https://marjouxsjoias.com.br"); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(CheckoutConfigurationError);
    expect(error).toMatchObject({
      code: "invalid_production_site_url",
      message: "A origem do checkout não está configurada corretamente."
    });
  });

  it("requires the explicit production env even when the request origin is canonical", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(() => getPublicSiteUrl("https://marjouxsjoias.com.br"))
      .toThrow(expect.objectContaining({ code: "invalid_production_site_url" }));
    expect(() => getPublicSiteUrl())
      .toThrow(expect.objectContaining({ code: "invalid_production_site_url" }));
  });

  it.each(["development", "test"])("preserves a configured localhost origin in %s", mode => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000/");
    expect(getPublicSiteUrl()).toBe("http://localhost:3000");
  });

  it("preserves the request fallback and default localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(getPublicSiteUrl("http://localhost:3019")).toBe("http://localhost:3019");
    expect(getPublicSiteUrl()).toBe("http://localhost:3000");
  });

  it("produces the expected webhook and return paths without any network request", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marjouxsjoias.com.br/");
    const origin = getPublicSiteUrl();
    expect(`${origin}/api/payments/infinitepay/webhook`)
      .toBe("https://marjouxsjoias.com.br/api/payments/infinitepay/webhook");
    expect(`${origin}/pedido/confirmacao?token=fixture-token`)
      .toBe("https://marjouxsjoias.com.br/pedido/confirmacao?token=fixture-token");
  });
});
