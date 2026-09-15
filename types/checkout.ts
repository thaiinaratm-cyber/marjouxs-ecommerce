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

export type PublicOrderStatusStage =
  | "received"
  | "payment_approved"
  | "production"
  | "quality"
  | "ready"
  | "shipped"
  | "delivered"
  | "picked_up";

export type PublicOrderShippingAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

export type PublicOrder = {
  orderNumber: string;
  createdAt: string;
  paymentStatus: "pending" | "paid" | "failed" | "requires_review";
  statusStage: PublicOrderStatusStage;
  deliveryMethod: "shipping" | "pickup";
  shippingAddress: PublicOrderShippingAddress | null;
  shippingCarrier: string | null;
  shippingService: string | null;
  shippingDeadlineDays: number | null;
  trackingCode: string | null;
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
