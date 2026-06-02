export type CategoryName =
  | "Alianças"
  | "Anéis"
  | "Brincos"
  | "Correntes"
  | "Pulseiras"
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
  images: string[];
  featured: boolean;
  isCustomOrder: boolean;
  allowWhatsappQuote: boolean;
  stockStatus: StockStatus;
};

export type CartItem = {
  product: Product;
  quantity: number;
};
