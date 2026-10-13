import { z } from "zod";

export const ADMIN_PRODUCT_IMAGE_BUCKET = "ecommerce-product-images";
export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
export const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const stockStatuses = ["available", "made_to_order", "unavailable", "service"] as const;
const saleUnits = ["unit", "pair"] as const;

const rawProductSchema = z.object({
  name: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.string().uuid(),
  subcategoryId: z.union([z.literal(""), z.string().uuid()]),
  materialId: z.string().uuid(),
  price: z.string().trim().max(40),
  oldPrice: z.string().trim().max(40),
  discountPercent: z.string().trim().max(10),
  cashDiscountPercent: z.string().trim().max(10),
  installmentsCount: z.string().trim().max(4),
  shortDescription: z.string().trim().max(280),
  description: z.string().trim().max(12000),
  seoTitle: z.string().trim().max(180),
  seoDescription: z.string().trim().max(500),
  approximateWeightGrams: z.string().trim().max(24),
  widthMm: z.string().trim().max(24),
  thicknessMm: z.string().trim().max(24),
  heightMm: z.string().trim().max(24),
  lengthCm: z.string().trim().max(24),
  diameterMm: z.string().trim().max(24),
  finish: z.string().trim().max(180),
  stoneType: z.string().trim().max(180),
  stoneColor: z.string().trim().max(180),
  stoneQuantity: z.string().trim().max(6),
  materialDetails: z.string().trim().max(500),
  genderStyle: z.string().trim().max(180),
  technicalNotes: z.string().trim().max(2000),
  sizeMin: z.string().trim().max(3),
  sizeMax: z.string().trim().max(3),
  stockStatus: z.enum(stockStatuses),
  saleUnit: z.enum(saleUnits),
  isCustomOrder: z.boolean(),
  engravingAvailable: z.boolean(),
  engravingIncluded: z.boolean(),
  jewelryBoxIncluded: z.boolean(),
  isFeatured: z.boolean(),
  allowWhatsappQuote: z.boolean(),
  version: z.string().trim().max(12)
});

export type AdminProductInput = {
  name: string;
  slug: string;
  categoryId: string;
  subcategoryId: string | null;
  materialId: string;
  price: string | null;
  oldPrice: string | null;
  discountPercent: string | null;
  cashDiscountPercent: string | null;
  installmentsCount: number | null;
  shortDescription: string | null;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  approximateWeightGrams: string | null;
  widthMm: string | null;
  thicknessMm: string | null;
  heightMm: string | null;
  lengthCm: string | null;
  diameterMm: string | null;
  finish: string | null;
  stoneType: string | null;
  stoneColor: string | null;
  stoneQuantity: number | null;
  materialDetails: string | null;
  genderStyle: string | null;
  technicalNotes: string | null;
  sizeMin: number | null;
  sizeMax: number | null;
  stockStatus: (typeof stockStatuses)[number];
  saleUnit: (typeof saleUnits)[number];
  isCustomOrder: boolean;
  engravingAvailable: boolean;
  engravingIncluded: boolean;
  jewelryBoxIncluded: boolean;
  isFeatured: boolean;
  allowWhatsappQuote: boolean;
  version: number | null;
};

export type ProductFormResult =
  | { success: true; data: AdminProductInput }
  | { success: false; error: "invalid_fields" | "invalid_price" };

export function toProductSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function parseBrazilianPrice(value: string): string | null | undefined {
  const compact = value.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!compact) return null;

  let normalized = compact;
  if (compact.includes(",")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, "");
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;

  const [integerPart, decimalPart = ""] = normalized.split(".");
  const canonicalInteger = integerPart.replace(/^0+(?=\d)/, "");
  if (canonicalInteger.length > 10) return undefined;

  const cents = decimalPart.padEnd(2, "0");
  if (canonicalInteger === "0" && cents === "00") return undefined;

  return `${canonicalInteger}.${cents}`;
}

function parseDecimal(value: string, integerDigits: number, scale: number): string | null | undefined {
  const compact = value.replace(/\s+/g, "").replace(",", ".");
  if (!compact) return null;
  if (!new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,${scale}})?$`).test(compact)) return undefined;
  const [integer, fraction = ""] = compact.split(".");
  return `${integer.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(scale, "0")}`;
}

function parseInteger(value: string, minimum: number, maximum: number): number | null | undefined {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

export function parseAdminProductForm(formData: FormData): ProductFormResult {
  const name = String(formData.get("name") ?? "").trim();
  const suppliedSlug = String(formData.get("slug") ?? "").trim();
  const parsed = rawProductSchema.safeParse({
    name,
    slug: suppliedSlug || toProductSlug(name),
    categoryId: String(formData.get("categoryId") ?? ""),
    subcategoryId: String(formData.get("subcategoryId") ?? ""),
    materialId: String(formData.get("materialId") ?? ""),
    price: String(formData.get("price") ?? ""),
    oldPrice: String(formData.get("oldPrice") ?? ""),
    discountPercent: String(formData.get("discountPercent") ?? ""),
    cashDiscountPercent: String(formData.get("cashDiscountPercent") ?? ""),
    installmentsCount: String(formData.get("installmentsCount") ?? ""),
    shortDescription: String(formData.get("shortDescription") ?? ""),
    description: String(formData.get("description") ?? ""),
    seoTitle: String(formData.get("seoTitle") ?? ""),
    seoDescription: String(formData.get("seoDescription") ?? ""),
    approximateWeightGrams: String(formData.get("approximateWeightGrams") ?? ""),
    widthMm: String(formData.get("widthMm") ?? ""),
    thicknessMm: String(formData.get("thicknessMm") ?? ""),
    heightMm: String(formData.get("heightMm") ?? ""),
    lengthCm: String(formData.get("lengthCm") ?? ""),
    diameterMm: String(formData.get("diameterMm") ?? ""),
    finish: String(formData.get("finish") ?? ""),
    stoneType: String(formData.get("stoneType") ?? ""),
    stoneColor: String(formData.get("stoneColor") ?? ""),
    stoneQuantity: String(formData.get("stoneQuantity") ?? ""),
    materialDetails: String(formData.get("materialDetails") ?? ""),
    genderStyle: String(formData.get("genderStyle") ?? ""),
    technicalNotes: String(formData.get("technicalNotes") ?? ""),
    sizeMin: String(formData.get("sizeMin") ?? ""),
    sizeMax: String(formData.get("sizeMax") ?? ""),
    stockStatus: String(formData.get("stockStatus") ?? "available"),
    saleUnit: String(formData.get("saleUnit") ?? "unit"),
    isCustomOrder: formData.get("isCustomOrder") === "on",
    engravingAvailable: formData.get("engravingAvailable") === "on",
    engravingIncluded: formData.get("engravingIncluded") === "on",
    jewelryBoxIncluded: formData.get("jewelryBoxIncluded") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    allowWhatsappQuote: formData.get("allowWhatsappQuote") === "on",
    version: String(formData.get("version") ?? "")
  });

  if (!parsed.success) return { success: false, error: "invalid_fields" };

  const price = parseBrazilianPrice(parsed.data.price);
  const oldPrice = parseBrazilianPrice(parsed.data.oldPrice);
  if (price === undefined || oldPrice === undefined) return { success: false, error: "invalid_price" };

  const discountPercent = parseDecimal(parsed.data.discountPercent, 3, 2);
  const cashDiscountPercent = parseDecimal(parsed.data.cashDiscountPercent, 3, 2);
  const measurements = {
    approximateWeightGrams: parseDecimal(parsed.data.approximateWeightGrams, 7, 3),
    widthMm: parseDecimal(parsed.data.widthMm, 8, 2),
    thicknessMm: parseDecimal(parsed.data.thicknessMm, 8, 2),
    heightMm: parseDecimal(parsed.data.heightMm, 8, 2),
    lengthCm: parseDecimal(parsed.data.lengthCm, 8, 2),
    diameterMm: parseDecimal(parsed.data.diameterMm, 8, 2)
  };
  const installmentsCount = parseInteger(parsed.data.installmentsCount, 1, 24);
  const stoneQuantity = parseInteger(parsed.data.stoneQuantity, 0, 9999);
  const sizeMin = parseInteger(parsed.data.sizeMin, 8, 35);
  const sizeMax = parseInteger(parsed.data.sizeMax, 8, 35);
  const version = parseInteger(parsed.data.version, 1, 2147483647);
  if (discountPercent === undefined || cashDiscountPercent === undefined ||
      Object.values(measurements).some((value) => value === undefined) ||
      [installmentsCount, stoneQuantity, sizeMin, sizeMax, version].some((value) => value === undefined) ||
      (discountPercent !== null && Number(discountPercent) > 100) ||
      (cashDiscountPercent !== null && Number(cashDiscountPercent) > 100) ||
      (typeof sizeMin === "number" && typeof sizeMax === "number" && sizeMin > sizeMax) ||
      (parsed.data.engravingIncluded && !parsed.data.engravingAvailable)) {
    return { success: false, error: "invalid_fields" };
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      subcategoryId: parsed.data.subcategoryId || null,
      price,
      oldPrice,
      discountPercent: discountPercent ?? null,
      cashDiscountPercent: cashDiscountPercent ?? null,
      installmentsCount: installmentsCount ?? null,
      shortDescription: parsed.data.shortDescription || null,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      approximateWeightGrams: measurements.approximateWeightGrams ?? null,
      widthMm: measurements.widthMm ?? null,
      thicknessMm: measurements.thicknessMm ?? null,
      heightMm: measurements.heightMm ?? null,
      lengthCm: measurements.lengthCm ?? null,
      diameterMm: measurements.diameterMm ?? null,
      finish: parsed.data.finish || null,
      stoneType: parsed.data.stoneType || null,
      stoneColor: parsed.data.stoneColor || null,
      stoneQuantity: stoneQuantity ?? null,
      materialDetails: parsed.data.materialDetails || null,
      genderStyle: parsed.data.genderStyle || null,
      technicalNotes: parsed.data.technicalNotes || null,
      sizeMin: sizeMin ?? null,
      sizeMax: sizeMax ?? null,
      version: version ?? null
    }
  };
}

export function validateProductImage(file: { type: string; size: number }) {
  if (!PRODUCT_IMAGE_MIME_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_MIME_TYPES)[number])) {
    return "invalid_type" as const;
  }

  if (file.size <= 0 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return "invalid_size" as const;
  }

  return null;
}

export function validateProductActivation(
  product: {
    name?: string | null;
    slug?: string | null;
    category_id?: string | null;
    material_id?: string | null;
  },
  hasPrimaryImage: boolean
) {
  if (!product.name?.trim() || !product.slug?.trim() || !product.category_id || !product.material_id) {
    return "incomplete_product" as const;
  }

  if (!hasPrimaryImage) return "primary_image_required" as const;

  return null;
}
