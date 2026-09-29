import { products } from "@/data/products";
import { hasValidPrice } from "@/lib/product-pricing";
import type { CartLineInput, ShippingLineInput, ValidatedCart, ValidatedCartItem } from "@/types/checkout";
import type { CartCustomization, Product } from "@/types/product";
import { ringPairCustomizationSchema } from "@/lib/checkout/schemas";

const CHECKOUT_STOCK_STATUSES = new Set(["Disponível", "Sob encomenda"]);

export class CheckoutValidationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
    readonly details?: { productSlug: string; currentPriceCents: number }
  ) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export function isAlliance(product: Product) {
  return product.category === "Alianças";
}

export function getProductById(productId: string) {
  return products.find((product) => product.id === productId);
}

export type CheckoutProductRecord = { product: Product; unitPriceCents?: number };
export type CheckoutProductResolver = (productId: string, productSlug: string) => CheckoutProductRecord;

function getStaticCheckoutProduct(productId: string, productSlug: string): CheckoutProductRecord {
  const product = getProductById(productId);
  if (!product || product.slug !== productSlug) {
    throw new CheckoutValidationError(
      "Um produto do carrinho não foi encontrado.",
      "product_not_found",
      404
    );
  }

  return { product };
}

function getCheckoutProduct(productId: string, productSlug: string, resolver: CheckoutProductResolver) {
  const record = resolver(productId, productSlug);
  const { product } = record;

  if (!hasValidPrice(product) || typeof product.price !== "number") {
    throw new CheckoutValidationError(
      `${product.name} está disponível somente por atendimento.`,
      "product_without_price"
    );
  }

  if (!CHECKOUT_STOCK_STATUSES.has(product.stockStatus)) {
    throw new CheckoutValidationError(
      `${product.name} não está disponível para checkout.`,
      "product_not_available"
    );
  }

  if (!product.images[0]?.trim()) {
    throw new CheckoutValidationError(
      `${product.name} não possui imagem válida para o checkout.`,
      "product_without_image"
    );
  }

  return record;
}

function getPriceCents({ product, unitPriceCents }: CheckoutProductRecord) {
  const cents = unitPriceCents ?? Math.round((product.price ?? 0) * 100);

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new CheckoutValidationError(
      `${product.name} possui um preço inválido.`,
      "invalid_catalog_price"
    );
  }

  return cents;
}

function validateCustomization(product: Product, quantity: number, customization: CartCustomization) {
  if (isAlliance(product)) {
    if (product.saleUnit && product.saleUnit !== "pair") {
      throw new CheckoutValidationError("Este produto não está disponível para checkout.", "product_unavailable", 409);
    }
    if (quantity !== 1) {
      throw new CheckoutValidationError(
        "Cada par de alianças deve ser uma linha com quantidade 1.",
        "invalid_alliance_quantity"
      );
    }

    const parsedCustomization = ringPairCustomizationSchema.safeParse(customization);
    if (!parsedCustomization.success) {
      throw new CheckoutValidationError(
        "Informe os dois aros entre 8 e 35 antes de continuar.",
        "invalid_alliance_customization"
      );
    }

    const { ring1, ring2 } = parsedCustomization.data;
    const minimum = product.sizeMin ?? 8;
    const maximum = product.sizeMax ?? 35;
    if ([ring1.size, ring2.size].some((size) => size < minimum || size > maximum)) {
      throw new CheckoutValidationError("Informe os dois aros dentro da faixa disponível.", "invalid_alliance_customization");
    }
    if (product.engravingAvailable === false && [ring1.engraving, ring2.engraving].some((text) => Boolean(text?.trim()))) {
      throw new CheckoutValidationError("Este produto não aceita gravação.", "unsupported_customization");
    }

    return parsedCustomization.data;
  }

  if (product.saleUnit === "pair") {
    throw new CheckoutValidationError("Este produto não está disponível para checkout.", "product_unavailable", 409);
  }

  if (customization !== null) {
    throw new CheckoutValidationError(
      "Este produto não aceita essa personalização.",
      "unsupported_customization"
    );
  }

  return null;
}

export function resolveCheckoutCart(
  lines: CartLineInput[],
  resolver: CheckoutProductResolver = getStaticCheckoutProduct,
  priceChangePolicy: "reject" | "report" = "reject"
): ValidatedCart {
  const priceChanges: NonNullable<ValidatedCart["priceChanges"]> = [];
  const items = lines.map<ValidatedCartItem>((line) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new CheckoutValidationError("A quantidade informada é inválida.", "invalid_quantity");
    }
    const record = getCheckoutProduct(line.productId, line.productSlug, resolver);
    const { product } = record;
    const unitPriceCents = getPriceCents(record);
    if (line.displayedUnitPriceCents !== undefined && line.displayedUnitPriceCents !== unitPriceCents) {
      if (priceChangePolicy === "reject") {
        throw new CheckoutValidationError(
          "O preço de um produto mudou. Revise o valor atualizado antes de continuar.",
          "price_changed",
          409,
          { productSlug: product.slug, currentPriceCents: unitPriceCents }
        );
      }
      priceChanges.push({ productSlug: product.slug, currentPriceCents: unitPriceCents });
    }
    const customization = validateCustomization(product, line.quantity, line.customization);
    const subtotalCents = unitPriceCents * line.quantity;

    if (!Number.isSafeInteger(subtotalCents)) {
      throw new CheckoutValidationError(
        "O valor do carrinho ultrapassa o limite suportado.",
        "cart_total_overflow"
      );
    }

    return {
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      image: product.images[0] ?? "",
      category: product.category,
      subcategory: product.subcategory || null,
      material: product.material || null,
      availability: product.stockStatus as "Disponível" | "Sob encomenda",
      unitPriceCents,
      quantity: line.quantity,
      subtotalCents,
      customization
    };
  });

  const subtotalCents = items.reduce((total, item) => total + item.subtotalCents, 0);

  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) {
    throw new CheckoutValidationError("O subtotal do carrinho é inválido.", "invalid_cart_subtotal");
  }

  return { items, subtotalCents, ...(priceChanges.length > 0 ? { priceChanges } : {}) };
}

export function resolveShipmentCart(
  lines: ShippingLineInput[],
  resolver: CheckoutProductResolver = getStaticCheckoutProduct
) {
  const items = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new CheckoutValidationError("A quantidade informada é inválida.", "invalid_quantity");
    }

    const record = getCheckoutProduct(line.productId, line.productSlug, resolver);
    const { product } = record;

    if (isAlliance(product) && line.quantity !== 1) {
      throw new CheckoutValidationError(
        "Cada par de alianças deve ter quantidade 1.",
        "invalid_alliance_quantity"
      );
    }

    const unitPriceCents = getPriceCents(record);
    const subtotalCents = unitPriceCents * line.quantity;
    if (!Number.isSafeInteger(subtotalCents)) {
      throw new CheckoutValidationError("O valor do carrinho ultrapassa o limite suportado.", "cart_total_overflow");
    }
    return {
      productId: product.id,
      productSlug: product.slug,
      quantity: line.quantity,
      unitPriceCents,
      subtotalCents
    };
  });

  const subtotalCents = items.reduce((total, item) => total + item.subtotalCents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) {
    throw new CheckoutValidationError("O valor segurado do envio é inválido.", "invalid_shipping_value");
  }

  return { items, subtotalCents };
}
