import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/checkout/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/checkout/shipping", () => ({ ShippingProviderError: class extends Error {} }));
import { blockedCheckoutLink, transitionCheckoutLink } from "@/lib/checkout/checkout-link";

const id = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const row = {
  result_code: "reserved", result_attempt_id: id, result_attempt_status: "creating",
  result_checkout_url: null, result_provider_checkout_id: null,
  result_lease_expires_at: "2030-01-01T00:00:00.000Z"
};

describe("checkout link RPC contract", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: [row],error: null });
    vi.spyOn(console,"info").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses the exact installed arguments, without link fields before complete", async () => {
    await transitionCheckoutLink(id,"claim",owner);
    expect(mocks.rpc).toHaveBeenCalledWith("ecommerce_checkout_link_transition", {
      p_attempt_id:id,p_action:"claim",p_claim_token:owner
    });
  });

  it.each([
    null, [], [row,row], [{ ...row,result_code:"unrecognized" }],
    [{ ...row,result_attempt_id:owner }], [{ ...row,result_lease_expires_at:null }],
    [{ ...row,result_code:"dispatch_granted",result_attempt_status:"pending" }],
    [{ ...row,result_code:"reuse_link",result_attempt_status:"pending",result_checkout_url:"http://unsafe.invalid",result_provider_checkout_id:"link" }]
  ].map(value => [value]))("fails closed on invalid response %j", async data => {
    mocks.rpc.mockResolvedValue({ data,error:null });
    await expect(transitionCheckoutLink(id,"claim",owner)).rejects.toMatchObject({ publicCode:"checkout_link_unavailable" });
  });

  it("paid order can report already_paid while this particular attempt is still creating", async () => {
    mocks.rpc.mockResolvedValue({ data:[{ ...row,result_code:"already_paid" }],error:null });
    expect((await transitionCheckoutLink(id,"claim",owner)).result_code).toBe("already_paid");
  });

  it.each([
    ["in_progress","checkout_link_in_progress"], ["stale_claim","checkout_link_in_progress"],
    ["dispatch_uncertain","checkout_link_dispatch_uncertain"], ["legacy_dispatch_unknown","checkout_link_legacy_unknown"],
    ["dispatch_state_invalid","checkout_link_state_invalid"]
  ])("maps %s to a safe error", async (outcome,code) => {
    mocks.rpc.mockResolvedValue({ data:[{ ...row,result_code:outcome }],error:null });
    const result = await transitionCheckoutLink(id,"claim",owner);
    expect(() => blockedCheckoutLink(result)).toThrow(expect.objectContaining({ publicCode:code }));
  });

  it("does not serialize raw RPC errors or thrown network messages", async () => {
    mocks.rpc.mockRejectedValue(new Error("secret-token qa@example.invalid"));
    const error = await transitionCheckoutLink(id,"claim",owner).catch(error => error);
    expect(error.publicCode).toBe("checkout_link_unavailable");
    expect(JSON.stringify(error)).not.toContain("secret-token");
    expect(JSON.stringify(error)).not.toContain("qa@example.invalid");
  });
});
