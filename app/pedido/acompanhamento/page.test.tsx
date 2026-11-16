import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrderProgressPage, { dynamic, metadata } from "@/app/pedido/acompanhamento/page";
import { metadata as confirmationMetadata } from "@/app/pedido/confirmacao/page";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";

const mocks = vi.hoisted(() => ({ cookie: vi.fn(), read: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Error(url); } }));
vi.mock("@/lib/checkout/orders", () => ({ getPublicOrder: mocks.read }));
vi.mock("@/components/order-confirmation", () => ({ OrderConfirmationView: () => null }));
const token = "00000000-0000-4000-8000-000000000099";

describe("private tracking page", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("React", React); });
  afterEach(() => vi.unstubAllGlobals());
  it("never indexes individual orders", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata).toMatchObject({ robots: { index: false, follow: false }, referrer: "no-referrer" });
    expect(confirmationMetadata.robots).toMatchObject({ index: false, follow: false });
  });
  it.each([undefined, "invalid"])("does not read an order without access", async value => {
    mocks.cookie.mockReturnValue(value ? { value } : undefined);
    await expect(OrderProgressPage()).rejects.toThrow("/acompanhar-pedido");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses the scoped cookie and passes only the allowlisted fields to the UI", async () => {
    mocks.cookie.mockReturnValue({ value: token });
    mocks.read.mockResolvedValue({ ...confirmationFixture(), public_token: token, customer_phone: "private-phone",
      customer_email: "private-email", checkout_url: "private-checkout", transaction_nsu: "private-provider",
      shippingAddress: { street: "private-address" }, customer_cpf: "private-cpf" });
    const element = await OrderProgressPage();
    expect(mocks.read.mock.calls).toEqual([[token]]);
    expect(element.props.tracking).toBe(true);
    expect(element.props.state.order.orderNumber).toBe("MJ-000123");
    expect(JSON.stringify(element.props)).not.toMatch(/private-|public_token|00000000-0000/);
  });
});
