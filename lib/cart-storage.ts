import { hasValidPrice } from "@/lib/product-pricing";
import { getProductById, isAlliance } from "@/lib/checkout/catalog";
import type { CartLine, Product } from "@/types/product";
import { ringPairCustomizationSchema } from "@/lib/checkout/schemas";

export const CART_STORAGE_KEY = "marjouxs-cart";
export const CART_STORAGE_VERSION = 2;

type StoredCartV2 = {
  version: typeof CART_STORAGE_VERSION;
  items: CartLine[];
};

function createLineId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function storedProduct(value: unknown, id: string, slug: string): Product | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Product>;
  if (candidate.id !== id || candidate.slug !== slug ||
      typeof candidate.name !== "string" || typeof candidate.description !== "string" ||
      typeof candidate.category !== "string" || typeof candidate.subcategory !== "string" ||
      typeof candidate.material !== "string" || typeof candidate.priceLabel !== "string" ||
      typeof candidate.installments !== "string" || typeof candidate.featured !== "boolean" ||
      typeof candidate.isCustomOrder !== "boolean" || typeof candidate.allowWhatsappQuote !== "boolean" ||
      !Array.isArray(candidate.images) || !candidate.images.every((image) => typeof image === "string") ||
      !["Disponível", "Sob encomenda"].includes(candidate.stockStatus ?? "") ||
      !hasValidPrice(candidate as Product)) return null;
  return candidate as Product;
}

function normalizeLine(value: unknown): CartLine | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<CartLine>;
  const snapshot = typeof candidate.productId === "string" && typeof candidate.productSlug === "string"
    ? storedProduct(candidate.productSnapshot, candidate.productId, candidate.productSlug)
    : null;
  const product = snapshot ?? (typeof candidate.productId === "string" ? getProductById(candidate.productId) : undefined);

  if (!product || !hasValidPrice(product)) {
    return null;
  }

  const rawQuantity = Number(candidate.quantity);
  const quantity = isAlliance(product) ? 1 : Math.max(1, Math.floor(Number.isFinite(rawQuantity) ? rawQuantity : 1));
  const parsedCustomization = ringPairCustomizationSchema.safeParse(candidate.customization);
  const customization = parsedCustomization.success ? parsedCustomization.data : null;

  return {
    lineId: typeof candidate.lineId === "string" && candidate.lineId ? candidate.lineId : createLineId(),
    productId: product.id,
    productSlug: product.slug,
    quantity,
    customization: isAlliance(product) ? customization : null,
    ...(snapshot ? { productSnapshot: snapshot } : {})
  };
}

function migrateLegacyCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const legacy = entry as {
      product?: { id?: unknown; slug?: unknown };
      quantity?: unknown;
    };
    const productId = typeof legacy.product?.id === "string" ? legacy.product.id : "";

    const normalized = normalizeLine({
      lineId: createLineId(),
      productId,
      productSlug: typeof legacy.product?.slug === "string" ? legacy.product.slug : "",
      quantity: legacy.quantity,
      customization: null
    });

    return normalized ? [normalized] : [];
  });
}

export function parseStoredCart(rawValue: string | null): CartLine[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (Array.isArray(parsed)) {
      return migrateLegacyCart(parsed);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as Partial<StoredCartV2>).version === CART_STORAGE_VERSION &&
      Array.isArray((parsed as Partial<StoredCartV2>).items)
    ) {
      return ((parsed as StoredCartV2).items ?? []).flatMap((item) => {
        const normalized = normalizeLine(item);
        return normalized ? [normalized] : [];
      });
    }
  } catch {
    return [];
  }

  return [];
}

export function serializeCart(items: CartLine[]) {
  const payload: StoredCartV2 = {
    version: CART_STORAGE_VERSION,
    items
  };

  return JSON.stringify(payload);
}

export function newCartLine(
  productId: string,
  productSlug: string,
  quantity = 1,
  customization: CartLine["customization"] = null,
  productSnapshot?: Product
): CartLine {
  return {
    lineId: createLineId(),
    productId,
    productSlug,
    quantity,
    customization,
    ...(productSnapshot ? { productSnapshot } : {})
  };
}
