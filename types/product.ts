export type CategoryName =
  | "Alianças"
  | "Anéis"
  | "Brincos"
  | "Correntes"
  | "Pulseiras"
  | "Braceletes"
  | "Pingentes"
  | "Relógios"
  | "Serviços";

export type StockStatus = "Disponível" | "Sob encomenda" | "Serviço" | "Indisponível";

export type Product = {
  id: string;
  name: string;
  slug: string;
  category: CategoryName;
  subcategory: string;
  material: string;
  price: number | null;
  oldPrice?: number | null;
  discountPercent?: number | null;
  cashDiscountPercent?: number | null;
  installmentsCount?: number | null;
  priceLabel: string;
  installments: string;
  description: string;
  tags?: string[];
  images: string[];
  featured: boolean;
  isCustomOrder: boolean;
  allowWhatsappQuote: boolean;
  stockStatus: StockStatus;
};

export type RingPairCustomization = {
  type: "ring_pair";
  ring1: {
    size: number;
    engraving?: string | null;
  };
  ring2: {
    size: number;
    engraving?: string | null;
  };
};

export type CartCustomization = RingPairCustomization | null;

export type CartLine = {
  lineId: string;
  productId: string;
  productSlug: string;
  quantity: number;
  customization: CartCustomization;
};

export type CartItem = CartLine & {
  product: Product;
};
