import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
  vi.stubGlobal("window", Object.assign(new EventTarget(), {
    location: { href: "https://marjouxsjoias.com.br/?gclid=click-1&gbraid=braid-1&wbraid=braid-2" }
  }));
  vi.stubGlobal("document", { referrer: "https://www.google.com/?q=joias" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google tag compartilhada", () => {
  it("configura Ads mesmo sem GA4 e não dispara conversão em uma página normal", async () => {
    const tag = await import("@/lib/google-tag");
    expect(tag.GOOGLE_TAG_SCRIPT_URL).toBe("https://www.googletagmanager.com/gtag/js?id=AW-18482833340");
    expect(tag.initializeGoogleTag()).toBe(true);
    const commands = window.dataLayer.map((args) => Array.from(args as ArrayLike<unknown>));
    expect(commands.filter(([command]) => command === "config")).toEqual([["config", "AW-18482833340"]]);
    expect(commands.some(([command]) => command === "event")).toBe(false);
    expect(commands).toContainEqual(["set", {
      page_location: window.location.href,
      page_referrer: "https://www.google.com/"
    }]);
  });

  it("reutiliza o GA4 e configura ambos os destinos só uma vez em montagens repetidas", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    const tag = await import("@/lib/google-tag");
    const existingGtag = vi.fn();
    const existingLayer = [{ existing: true }];
    window.gtag = existingGtag;
    window.dataLayer = existingLayer;
    tag.initializeGoogleTag();
    tag.initializeGoogleTag();
    expect(window.gtag).toBe(existingGtag);
    expect(window.dataLayer).toBe(existingLayer);
    expect(tag.GOOGLE_TAG_SCRIPT_URL).toBe("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
    expect(existingGtag.mock.calls.filter(([command]) => command === "config")).toEqual([
      ["config", "G-TEST123", { send_page_view: false, debug_mode: false }],
      ["config", "AW-18482833340"]
    ]);
    expect(existingGtag.mock.calls.filter(([command]) => command === "js")).toHaveLength(1);
  });

  it("não depende de window/document durante SSR", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    const tag = await import("@/lib/google-tag");
    expect(tag.initializeGoogleTag()).toBe(false);
    expect(() => tag.updateGooglePageContext()).not.toThrow();
  });

  it("remove token, dados pessoais, campos de compra e fragmento sem remover atribuição", async () => {
    const { getGoogleTrackingUrl } = await import("@/lib/google-tag");
    expect(getGoogleTrackingUrl(
      "https://marjouxsjoias.com.br/pedido/confirmacao?token=private&email=private%40example.com&value=1&transaction_id=fake&gclid=a&gbraid=b&wbraid=c&utm_source=google#secret"
    )).toBe("https://marjouxsjoias.com.br/pedido/confirmacao?gclid=a&gbraid=b&wbraid=c&utm_source=google");
    expect(getGoogleTrackingUrl("javascript:alert(1)")).toBe("");
    expect(getGoogleTrackingUrl("")).toBe("");
  });

  it("atualiza o contexto seguro na navegação sem reconfigurar a tag ou alterar a URL", async () => {
    const tag = await import("@/lib/google-tag");
    window.gtag = vi.fn();
    window.location.href = "https://marjouxsjoias.com.br/pedido/confirmacao?token=private";
    tag.updateGooglePageContext();
    expect(window.gtag).toHaveBeenCalledWith("set", {
      page_location: "https://marjouxsjoias.com.br/pedido/confirmacao",
      page_referrer: "https://www.google.com/"
    });
    expect(window.location.href).toContain("token=private");
  });

  it("notifica a prontidão do script para conversões cuja consulta já terminou", async () => {
    const tag = await import("@/lib/google-tag");
    const listener = vi.fn();
    window.addEventListener(tag.GOOGLE_TAG_READY_EVENT, listener);
    tag.markGoogleTagReady();
    expect(window.marjouxsGoogleTagReady).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });
});