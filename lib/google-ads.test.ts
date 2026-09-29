import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const confirmedOrder = {
  paymentStatus: "paid",
  paidAt: "2026-09-29T12:00:00.000Z",
  totalCents: 360000,
  orderNumber: "MJ-000123",
  shippingAddress: { street: "Private address" },
  customerEmail: "private@example.com",
  publicToken: "private-token"
};
let ads: typeof import("@/lib/google-ads");
let events: ReturnType<typeof vi.fn>;
let storage: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  events = vi.fn();
  storage = new Map();
  vi.stubGlobal("window", Object.assign(new EventTarget(), {
    location: { href: "https://marjouxsjoias.com.br/pedido/confirmacao?token=private&value=1&transaction_id=fake" },
    marjouxsGoogleTagReady: true,
    gtag: events,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    }
  }));
  vi.stubGlobal("document", { referrer: "https://checkout.infinitepay.io/?token=private" });
  ads = await import("@/lib/google-ads");
});

afterEach(() => vi.unstubAllGlobals());

describe("Google Ads Compra", () => {
  it("usa destino, moeda, total em reais e ID estável do pedido da API; não copia dados privados", () => {
    expect(ads.getGoogleAdsPurchase(confirmedOrder)).toEqual({
      send_to: "AW-18482833340/t-gCCNS624odELzPpu1E",
      value: 3600,
      currency: "BRL",
      transaction_id: "MJ-000123"
    });
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    expect(events).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-18482833340/t-gCCNS624odELzPpu1E",
      value: 3600,
      currency: "BRL",
      transaction_id: "MJ-000123",
      page_location: "https://marjouxsjoias.com.br/pedido/confirmacao",
      page_referrer: "https://checkout.infinitepay.io/"
    });
    expect(JSON.stringify(events.mock.calls)).not.toMatch(/private|new_customer|user_data/);
  });

  it("mantém centavos e o total persistido, incluindo frete e desconto, sem recalcular pelo carrinho", () => {
    expect(ads.getGoogleAdsPurchase({
      ...confirmedOrder, subtotalCents: 400000, shippingCents: 1499, discountCents: 40000, totalCents: 361499
    })?.value).toBe(3614.99);
  });

  it.each([
    null, undefined, {},
    { ...confirmedOrder, paymentStatus: "pending" },
    { ...confirmedOrder, paymentStatus: "failed" },
    { ...confirmedOrder, paymentStatus: "requires_review" },
    { ...confirmedOrder, paidAt: null },
    { ...confirmedOrder, paidAt: "invalid" },
    { ...confirmedOrder, totalCents: 0 },
    { ...confirmedOrder, totalCents: -1 },
    { ...confirmedOrder, totalCents: 123.5 },
    { ...confirmedOrder, totalCents: Number.NaN },
    { ...confirmedOrder, totalCents: Number.MAX_SAFE_INTEGER + 1 },
    { ...confirmedOrder, totalCents: "360000" },
    { ...confirmedOrder, orderNumber: "" },
    { ...confirmedOrder, orderNumber: "fake@example.com" },
    { ...confirmedOrder, orderNumber: "x".repeat(65) }
  ])("não dispara para pedido sem confirmação válida: %j", (order) => {
    expect(ads.getGoogleAdsPurchase(order)).toBeNull();
    ads.trackGoogleAdsPurchaseWhenReady(order);
    window.dispatchEvent(new Event("marjouxs:google-tag-ready"));
    expect(events).not.toHaveBeenCalled();
  });

  it("ignora parâmetros fraudulentos de compra e aguarda o estado pago retornado pela API", () => {
    window.location.href += "&paymentStatus=paid&paidAt=2026-09-29";
    ads.trackGoogleAdsPurchaseWhenReady({ ...confirmedOrder, paymentStatus: "pending" });
    expect(events).not.toHaveBeenCalled();
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    expect(events.mock.calls[0][2]).toMatchObject({ value: 3600, transaction_id: "MJ-000123" });
  });

  it("impede repetição em rerenders/Strict Mode e aceita outra compra legítima", () => {
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    window.dispatchEvent(new Event("marjouxs:google-tag-ready"));
    expect(events).toHaveBeenCalledOnce();
    ads.trackGoogleAdsPurchaseWhenReady({ ...confirmedOrder, orderNumber: "MJ-000124" });
    expect(events).toHaveBeenCalledTimes(2);
  });

  it("impede reenvio após recarregar o módulo/página com o marcador persistido", async () => {
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    vi.resetModules();
    const reloaded = await import("@/lib/google-ads");
    reloaded.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    expect(events).toHaveBeenCalledOnce();
    expect(Array.from(storage.values())).toEqual(["1"]);
  });

  it("espera o carregamento da tag sem perder uma confirmação rápida", () => {
    window.marjouxsGoogleTagReady = false;
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    expect(events).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
    window.marjouxsGoogleTagReady = true;
    window.dispatchEvent(new Event("marjouxs:google-tag-ready"));
    window.dispatchEvent(new Event("marjouxs:google-tag-ready"));
    expect(events).toHaveBeenCalledOnce();
  });

  it("cancela o disparo pendente ao desmontar/trocar de token", () => {
    window.marjouxsGoogleTagReady = false;
    const stop = ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    stop();
    window.marjouxsGoogleTagReady = true;
    window.dispatchEvent(new Event("marjouxs:google-tag-ready"));
    expect(events).not.toHaveBeenCalled();
    ads.trackGoogleAdsPurchaseWhenReady({ ...confirmedOrder, orderNumber: "MJ-000124" });
    expect(events).toHaveBeenCalledOnce();
  });

  it("continua seguro sem localStorage e mantém transaction_id para deduplicação pelo Google", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => { throw new Error("storage blocked"); });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
    expect(() => {
      ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
      ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    }).not.toThrow();
    expect(events).toHaveBeenCalledOnce();
    expect(events.mock.calls[0][2].transaction_id).toBe("MJ-000123");
  });

  it("não marca um envio falho nem deixa erro do gtag afetar a confirmação", () => {
    events.mockImplementationOnce(() => { throw new Error("tag error"); });
    const stop = ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    expect(storage.size).toBe(0);
    stop();
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder);
    expect(events).toHaveBeenCalledTimes(2);
    expect(storage.size).toBe(1);
  });

  it("não tenta disparar no servidor ou sem gtag disponível", () => {
    window.gtag = undefined;
    ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder)();
    expect(events).not.toHaveBeenCalled();
    vi.stubGlobal("window", undefined);
    expect(() => ads.trackGoogleAdsPurchaseWhenReady(confirmedOrder)()).not.toThrow();
  });
});