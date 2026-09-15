import { describe, expect, it } from "vitest";
import {
  getOrderPresentationStage,
  getOrderTimeline,
  shouldClearCartAfterPayment
} from "@/lib/order-status";
import type { PublicOrderItem } from "@/types/checkout";
import type { CartLine } from "@/types/product";

const standardLine: CartLine = {
  lineId: "line-1",
  productId: "produto-1",
  productSlug: "produto-1",
  quantity: 1,
  customization: null
};

const standardItem: PublicOrderItem = {
  productSlug: "produto-1",
  productName: "Produto",
  productImage: "/produtos/produto.webp",
  category: "Anéis",
  material: "Ouro 18k",
  unitPriceCents: 10000,
  quantity: 1,
  subtotalCents: 10000,
  customization: null
};

describe("getOrderTimeline", () => {
  it("não avança além de pedido recebido enquanto o pagamento está pendente", () => {
    const timeline = getOrderTimeline({
      deliveryMethod: "shipping",
      statusStage: getOrderPresentationStage({
        deliveryMethod: "shipping",
        paymentStatus: "pending",
        orderStatus: "in_production"
      })
    });

    expect(timeline[0].state).toBe("current");
    expect(timeline.slice(1).every((step) => step.state === "upcoming")).toBe(true);
  });

  it("usa o pagamento confirmado como sinal real para aprovar a segunda etapa", () => {
    const timeline = getOrderTimeline({
      deliveryMethod: "pickup",
      statusStage: getOrderPresentationStage({
        deliveryMethod: "pickup",
        paymentStatus: "paid",
        orderStatus: "pending_payment"
      })
    });

    expect(timeline.map((step) => step.label)).toContain("Pronto para retirada");
    expect(timeline[0].state).toBe("complete");
    expect(timeline[1].state).toBe("current");
  });

  it("só apresenta produção quando o status operacional e o pagamento permitem", () => {
    const timeline = getOrderTimeline({
      deliveryMethod: "shipping",
      statusStage: getOrderPresentationStage({
        deliveryMethod: "shipping",
        paymentStatus: "paid",
        orderStatus: "in_production"
      })
    });

    expect(timeline[2]).toMatchObject({ label: "Em produção", state: "current" });
  });

  it("mapeia os estados finais específicos de entrega e retirada", () => {
    const deliveredStage = getOrderPresentationStage({
      deliveryMethod: "shipping",
      paymentStatus: "paid",
      orderStatus: "delivered"
    });
    const pickupStage = getOrderPresentationStage({
      deliveryMethod: "pickup",
      paymentStatus: "paid",
      orderStatus: "ready_for_pickup"
    });

    expect(
      getOrderTimeline({ deliveryMethod: "shipping", statusStage: deliveredStage }).at(-1)
    ).toMatchObject({ label: "Entregue", state: "current" });
    expect(
      getOrderTimeline({ deliveryMethod: "pickup", statusStage: pickupStage })[4]
    ).toMatchObject({ label: "Pronto para retirada", state: "current" });
  });

  it("não inventa avanço quando recebe um status operacional desconhecido", () => {
    expect(
      getOrderPresentationStage({
        deliveryMethod: "shipping",
        paymentStatus: "paid",
        orderStatus: "status_futuro_desconhecido"
      })
    ).toBe("payment_approved");
  });
});

describe("shouldClearCartAfterPayment", () => {
  it("preserva a sacola antes da confirmação real", () => {
    expect(shouldClearCartAfterPayment("pending", [standardLine], [standardItem])).toBe(false);
  });

  it("limpa a sacola correspondente quando o pagamento está confirmado", () => {
    expect(shouldClearCartAfterPayment("paid", [standardLine], [standardItem])).toBe(true);
  });

  it("preserva uma sacola nova ou diferente ao revisitar um pedido pago", () => {
    expect(
      shouldClearCartAfterPayment(
        "paid",
        [{ ...standardLine, productSlug: "outro-produto" }],
        [standardItem]
      )
    ).toBe(false);
  });

  it("compara gravações Unicode sem perder conteúdo", () => {
    const customization = {
      type: "ring_pair" as const,
      ring1: { size: 18, engraving: "João & Lívia" },
      ring2: { size: 16, engraving: null }
    };

    expect(
      shouldClearCartAfterPayment(
        "paid",
        [{ ...standardLine, customization }],
        [{ ...standardItem, customization }]
      )
    ).toBe(true);
  });
});
