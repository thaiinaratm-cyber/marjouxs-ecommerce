import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);
import { OrderDeliveryDetails, OrderItemsList } from "@/components/order-summary";
import { confirmationFixture } from "@/lib/checkout/confirmation.fixture";

describe("untrusted order text is escaped, never executed", () => {
  it.each(["<script>alert(1)</script>", "<img src=x onerror=alert(1)>"])("escapes %s in product, engraving and address", payload => {
    const order = confirmationFixture({ deliveryMethod: "shipping" });
    order.items[0].productName = payload;
    order.items[0].customization = { type: "ring_pair", ring1: { size: 18, engraving: payload }, ring2: { size: 16, engraving: "João ♥ Maria" } };
    order.shippingAddress = { postalCode: "07400805", street: payload, number: "1", complement: payload,
      neighborhood: payload, city: "Arujá", state: "SP" };
    const html = renderToStaticMarkup(<><OrderItemsList items={order.items} /><OrderDeliveryDetails order={order} /></>);
    expect(html).not.toContain(payload);
    expect(html).toContain(payload.replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
    expect(html).not.toContain("<script>");
    expect(html).toContain("João ♥ Maria");
  });
});
