import type { CartCustomization } from "@/types/product";

export type CartLineInput = {
  productId: string;
  productSlug: string;
  quantity: number;
  customization: CartCustomization;
};

export type ShippingLineInput = Omit<CartLineInput, "customization">;

export type ValidatedCartItem = {
  productId: string;
  productSlug: string;
  name: string;
  image: string;
  category: string;
  subcategory: string | null;
  material: string | null;
  availability: "Disponível" | "Sob encomenda";
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  customization: CartCustomization;
};

export type ValidatedCart = {
  items: ValidatedCartItem[];
  subtotalCents: number;
};

export type ShippingQuoteOption = {
  shippingQuoteId: string;
  serviceId: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryTimeDays: number;
  quotedAt: string;
};

export type PublicOrderItem = {
  id: string;
  productSlug: string;
  productName: string;
  productImage: string;
  category: string;
  material: string | null;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  customization: CartCustomization;
};

export type PublicOrder = {
  orderNumber: string;
  paymentStatus: "pending" | "paid" | "failed" | "requires_review";
  orderStatus: string;
  deliveryMethod: "shipping" | "pickup";
  shippingCarrier: string | null;
  shippingService: string | null;
  shippingDeadlineDays: number | null;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  paidAt: string | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  receiptUrl: string | null;
  items: PublicOrderItem[];
};
