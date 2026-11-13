import type { PublicOrder } from "@/types/checkout";

// Synthetic read-only fixture: never inserted into the database or sent to a provider.
export function confirmationFixture(overrides: Partial<PublicOrder> = {}): PublicOrder {
  return {
    orderNumber: "MJ-000123", createdAt: "2026-11-04T12:00:00.000Z", paymentStatus: "pending",
    statusStage: "received", deliveryMethod: "pickup", shippingAddress: null,
    shippingCarrier: null, shippingService: null, shippingDeadlineDays: null, trackingCode: null,
    subtotalCents: 16000, shippingCents: 0, discountCents: 0, totalCents: 16000,
    paidAt: null, paymentMethod: null, installments: null, receiptUrl: null,
    items: [{ productSlug: "fixture-qa", productName: "Joia de teste visual", productImage: "/produtos/anel-perola-natural-ouro-18k-3100.jpg",
      category: "Anéis", material: "Ouro 18k", quantity: 1, unitPriceCents: 16000, subtotalCents: 16000, customization: null }],
    ...overrides
  };
}
