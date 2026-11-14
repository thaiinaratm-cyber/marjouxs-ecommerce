import { describe, expect, it } from "vitest";
import { checkoutRedirect, checkoutResumeRequired } from "@/lib/checkout/checkout-redirect";

const origin = "https://marjouxsjoias.com.br";
const requestId = "00000000-0000-4000-8000-000000000002";
const expected = { origin, requestId, totalCents: 16000, resume: null };
const current = {
  requestId, orderNumber: "MJ-000002", totalCents: 16000,
  checkoutUrl: "https://checkout.infinitepay.io/marjouxsjoias?lenc=current-fixture",
  alreadyPaid: false, reusedLink: false
};

describe("checkout navigation requires the current successful response", () => {
  it.each([400, 409, 500, 503])("does not navigate on HTTP %i even if a link is present", status => {
    expect(checkoutRedirect(Response.json(current, { status }), current, expected)).toBeNull();
  });

  it.each([null, {}, { checkoutUrl: current.checkoutUrl }, { ...current, reusedLink: undefined }])(
    "does not use a fallback for a missing or invalid response", body => {
      expect(checkoutRedirect({ ok: true }, body, expected)).toBeNull();
    }
  );

  it("uses only the link returned for the active request", () => {
    expect(checkoutRedirect({ ok: true }, current, expected)).toBe(current.checkoutUrl);
    expect(checkoutRedirect({ ok: true }, { ...current, requestId: "old" }, expected)).toBeNull();
  });

  it("rejects the previous two-unit checkout even if its response has the current request ID", () => {
    expect(checkoutRedirect({ ok: true }, { ...current, totalCents: 32000, reusedLink: true }, expected)).toBeNull();
  });

  it("keeps no old URL and requires another response to resume the same pending order", () => {
    const old = { ...current, reusedLink: true };
    const notice = { ...old, code: "checkout_resume_required" };
    const resume = checkoutResumeRequired(409, notice, expected);
    expect(resume).toEqual({ requestId, orderNumber: current.orderNumber });
    expect(checkoutResumeRequired(409, { ...notice, requestId: "old" }, expected)).toBeNull();
    expect(checkoutResumeRequired(409, { ...notice, totalCents: 32000 }, expected)).toBeNull();
    expect(checkoutResumeRequired(500, notice, expected)).toBeNull();
    expect(checkoutRedirect({ ok: true }, old, expected)).toBeNull();

    const destination = { ...expected, resume };
    expect(checkoutRedirect({ ok: true }, { ...old, orderNumber: "MJ-000001" }, destination)).toBeNull();
    expect(checkoutRedirect({ ok: true }, { ...old, requestId: "different" }, destination)).toBeNull();
    expect(checkoutRedirect({ ok: true }, current, destination)).toBeNull();
    expect(checkoutRedirect({ ok: false }, old, destination)).toBeNull();
    expect(checkoutRedirect({ ok: true }, old, destination)).toBe(old.checkoutUrl);
  });

  it.each(["http://checkout.infinitepay.io/fixture", "https://checkout.infinitepay.io.example.invalid/fixture",
    "https://somebody@checkout.infinitepay.io/fixture", "javascript:void(0)"])("rejects a non-provider destination", checkoutUrl => {
    expect(checkoutRedirect({ ok: true }, { ...current, checkoutUrl }, expected)).toBeNull();
  });

  it("preserves the same-origin confirmation for an already-paid order", () => {
    const checkoutUrl = origin + "/pedido/confirmacao?token=fixture";
    expect(checkoutRedirect({ ok: true }, { ...current, alreadyPaid: true, checkoutUrl }, expected))
      .toBe(checkoutUrl);
    expect(checkoutRedirect({ ok: true }, { ...current, alreadyPaid: true }, expected)).toBeNull();
  });
});
