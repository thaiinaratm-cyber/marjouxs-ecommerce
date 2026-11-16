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

export type ProductTechnicalDetails = {
  weightGrams?: number;
  widthMm?: number;
  thicknessMm?: number;
  heightMm?: number;
  lengthCm?: number;
  diameterMm?: number;
  finish?: string;
  materialDetails?: string;
  stoneType?: string;
  stoneColor?: string;
  stoneQuantity?: number;
  genderStyle?: string;
  comfortProfile?: "anatomica" | "reta";
  structureType?: "solid" | "hollow";
};

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
  seoTitle?: string | null;
  seoDescription?: string | null;
  imageAlt?: string | null;
  tags?: string[];
  images: string[];
  featured: boolean;
  isCustomOrder: boolean;
  allowWhatsappQuote: boolean;
  stockStatus: StockStatus;
  saleUnit?: "pair" | "unit";
  engravingAvailable?: boolean;
  engravingIncluded?: boolean;
  jewelryBoxIncluded?: boolean;
  sizeMin?: number | null;
  sizeMax?: number | null;
  technicalDetails?: ProductTechnicalDetails;
  stoneCustomization?: { options: string[] };
};

export type RingPairCustomization = {
  type: "ring_pair";
  stone_color?: string;
  ring1: {
    size: number;
    engraving?: string | null;
  };
  ring2: {
    size: number;
    engraving?: string | null;
  };
};

export type CartCustomization = RingPairCustomization | { type: "stone"; stone_color: string } | null;

export type CartLine = {
  lineId: string;
  productId: string;
  productSlug: string;
  quantity: number;
  customization: CartCustomization;
  productSnapshot?: Product;
};

export type CartItem = CartLine & {
  product: Product;
};
