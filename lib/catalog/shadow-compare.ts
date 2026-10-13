import {
  mapLegacyProduct,
  type DatabaseSnapshot,
  type ImageAudit,
  type TargetProductRow
} from "../../scripts/migrate-products-to-supabase.ts";
import type { Product } from "../../types/product";
import type { DatabaseCatalog, DatabaseProduct, DatabaseProductImage } from "./database-products";
import { catalogImageUrl } from "./image-url.ts";

export type ShadowDifference = {
  severity: "critical" | "expected" | "informational";
  slug: string;
  field: string;
  expected: string;
  actual: string;
};

export type ManualBaseline = {
  id: string;
  legacy_id: null;
  name: string;
  slug: string;
  is_active: boolean;
};

export type ShadowResult = {
  staticCount: number;
  databaseLegacyCount: number;
  adminOnlyCount: number;
  matchedCount: number;
  missingInDb: string[];
  extraInDb: string[];
  differences: ShadowDifference[];
  prices: { equal: number; divergent: number; withoutPrice: number };
  status: { active: number; inactive: number; madeToOrder: number; customOrder: number };
  images: {
    equal: number;
    missing: number;
    placeholders: number;
    sharedPaths: string[];
    legacyImages: number;
    manualImages: number;
  };
  alliances: {
    total: number;
    soldAsPair: number;
    withSizeRange: number;
    engravingAvailable: number;
    engravingIncluded: number;
    jewelryBoxIncluded: number;
    inconsistencies: ShadowDifference[];
  };
  taxonomy: {
    categories: number;
    subcategories: number;
    materials: number;
    categoryDifferences: number;
    subcategoryDifferences: number;
    materialDifferences: number;
  };
  manual: { valid: boolean; slug: string | null; imageCount: number; baselineChecked: boolean };
};

const PRODUCT_FIELDS = [
  "name", "slug", "category_id", "subcategory_id", "material_id", "price", "old_price",
  "discount_percent", "cash_discount_percent", "description", "stock_status", "sale_unit",
  "is_custom_order", "is_featured", "allow_whatsapp_quote", "engraving_available",
  "engraving_included", "jewelry_box_included", "size_min", "size_max",
  "installments_count", "price_label_override", "installments_text_override"
] as const;

const MONEY_FIELDS = new Set<string>([
  "price", "old_price", "discount_percent", "cash_discount_percent"
]);

function decimal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  return match ? `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}` : `invalid:${String(value)}`;
}

function display(value: unknown): string {
  return value === null || value === undefined ? "null" : String(value);
}

function imageKey(image: { path: string; is_primary: boolean; sort_order: number; source_type: string }) {
  return `${image.sort_order}|${image.path}|${image.source_type}|${image.is_primary}`;
}

function imagesFor(productId: string, images: DatabaseProductImage[]) {
  return images.filter((image) => image.product_id === productId).sort((a, b) => a.sort_order - b.sort_order);
}

function taxonomySnapshot(database: DatabaseCatalog): DatabaseSnapshot {
  return {
    visibility: "service-role",
    categories: database.categories,
    subcategories: database.subcategories,
    materials: database.materials,
    products: database.products.map(({ id, legacy_id, name, slug, is_active }) => ({
      id, legacy_id, name, slug, is_active
    })),
    counts: { products: database.products.length, images: database.images.length }
  };
}

export function compareStaticAndDatabaseCatalog(
  staticProducts: Product[],
  database: DatabaseCatalog,
  imageAudits: Map<string, ImageAudit>,
  manualBaseline?: ManualBaseline
): ShadowResult {
  const differences: ShadowDifference[] = [];
  const add = (severity: ShadowDifference["severity"], slug: string, field: string, expected: unknown, actual: unknown) => {
    differences.push({ severity, slug, field, expected: display(expected), actual: display(actual) });
  };
  const legacy = database.products.filter((row) => row.legacy_id !== null);
  const manualProducts = database.products.filter((row) => row.legacy_id === null);
  const byLegacyId = new Map(legacy.map((row) => [row.legacy_id, row]));
  const staticIds = new Set(staticProducts.map((product) => product.id));
  const missingInDb: string[] = [];
  const extraInDb: string[] = [];
  const sourcePaths = new Map<string, number>();
  const snapshot = taxonomySnapshot(database);
  const prices = { equal: 0, divergent: 0, withoutPrice: 0 };
  const images = { equal: 0, missing: 0, placeholders: 0, sharedPaths: [] as string[], legacyImages: 0, manualImages: 0 };
  const alliances = {
    total: 0, soldAsPair: 0, withSizeRange: 0, engravingAvailable: 0,
    engravingIncluded: 0, jewelryBoxIncluded: 0, inconsistencies: [] as ShadowDifference[]
  };
  let matchedCount = 0;

  for (const product of staticProducts) {
    const audit = imageAudits.get(product.id);
    if (!audit) {
      add("critical", product.slug, "image_audit", "present", "missing");
      continue;
    }
    const plan = mapLegacyProduct(product, snapshot, audit);
    for (const issue of plan.issues) add("critical", product.slug, "mapping", "valid", issue);
    if (audit.placeholders.length > 0) images.placeholders += 1;
    for (const image of plan.images) sourcePaths.set(image.path, (sourcePaths.get(image.path) ?? 0) + 1);
    if (product.category === "Alianças") alliances.total += 1;

    const row = byLegacyId.get(product.id);
    if (!row) {
      missingInDb.push(product.slug);
      add("critical", product.slug, "legacy_id", product.id, "missing");
      continue;
    }
    matchedCount += 1;

    for (const field of PRODUCT_FIELDS) {
      const expected = plan.row[field as keyof TargetProductRow];
      const actual = row[field as keyof DatabaseProduct];
      const expectedValue = MONEY_FIELDS.has(field) ? decimal(expected) : display(expected);
      const actualValue = MONEY_FIELDS.has(field) ? decimal(actual) : display(actual);
      if (expectedValue !== actualValue) add(row.updated_by ? "expected" : "critical", product.slug, field, expectedValue, actualValue);
    }
    if (plan.activationCandidate !== row.is_active) {
      add(row.updated_by ? "expected" : "critical", product.slug, "is_active", plan.activationCandidate, row.is_active);
    } else if (!plan.activationCandidate) {
      add(
        "expected",
        product.slug,
        "inactive_by_migration",
        audit.valid.length === 0 ? "no valid source image" : "activation rule",
        "is_active=false"
      );
    }

    if (plan.row.price === null) prices.withoutPrice += 1;
    const priceEqual = decimal(plan.row.price) === decimal(row.price);
    const oldPriceEqual = decimal(plan.row.old_price) === decimal(row.old_price);
    if (priceEqual && oldPriceEqual && plan.row.price !== null) prices.equal += 1;
    if (!priceEqual || !oldPriceEqual) prices.divergent += 1;

    const actualImages = imagesFor(row.id, database.images);
    images.legacyImages += actualImages.length;
    const expectedImages = [...plan.images].sort((a, b) => a.sort_order - b.sort_order);
    if (expectedImages.length > 0 && actualImages.length === 0) images.missing += 1;
    if (expectedImages.map(imageKey).join("\n") === actualImages.map(imageKey).join("\n")) {
      images.equal += 1;
    } else {
      add(row.updated_by ? "expected" : "critical", product.slug, "images", expectedImages.map(imageKey).join("; ") || "none", actualImages.map(imageKey).join("; ") || "none");
    }

    if (product.category === "Alianças") {
      if (row.sale_unit === "pair") alliances.soldAsPair += 1;
      if (row.size_min === 8 && row.size_max === 35) alliances.withSizeRange += 1;
      if (row.engraving_available) alliances.engravingAvailable += 1;
      if (row.engraving_included) alliances.engravingIncluded += 1;
      if (row.jewelry_box_included) alliances.jewelryBoxIncluded += 1;
    }
  }

  for (const row of legacy) {
    if (!row.legacy_id || staticIds.has(row.legacy_id)) continue;
    extraInDb.push(row.slug);
    add("critical", row.slug, "legacy_id", "absent", row.legacy_id);
  }

  const manual = manualBaseline
    ? manualProducts.find((row) => row.id === manualBaseline.id)
    : manualProducts[0];
  images.manualImages = manualProducts.reduce((sum, row) => sum + imagesFor(row.id, database.images).length, 0);
  const productIds = new Set(database.products.map((row) => row.id));
  for (const image of database.images) {
    if (!productIds.has(image.product_id)) {
      add("critical", "database", "orphan_image", "product present", "missing");
    }
  }
  const activeTaxonomy = (row: DatabaseProduct) => {
    const category = database.categories.find((item) => item.id === row.category_id && item.is_active);
    const material = database.materials.find((item) => item.id === row.material_id && item.is_active);
    const subcategory = row.subcategory_id
      ? database.subcategories.find((item) => item.id === row.subcategory_id && item.category_id === row.category_id && item.is_active)
      : true;
    return category && material && subcategory &&
      (category.name === "Alianças"
        ? row.sale_unit === "pair" && row.size_min !== null && row.size_max !== null &&
          row.size_min >= 8 && row.size_max <= 35 && row.size_min <= row.size_max
        : row.sale_unit === "unit");
  };
  for (const row of legacy.filter((item) => item.is_active)) {
    const rowImages = imagesFor(row.id, database.images);
    const valid = Boolean(activeTaxonomy(row)) &&
      rowImages.filter((image) => image.is_primary).length === 1 &&
      rowImages.every((image) => catalogImageUrl(image, "https://example.supabase.co"));
    if (!valid) add("critical", row.slug, "active_product_invalid", "valid taxonomy and one primary image", "invalid");
  }
  let manualValid = !manualBaseline || Boolean(manual);
  for (const row of manualProducts) {
    const rowImages = imagesFor(row.id, database.images);
    const primaryImages = rowImages.filter((image) => image.is_primary);
    const valid = !row.is_active || Boolean(
      activeTaxonomy(row) && row.name.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) &&
      primaryImages.length === 1 && rowImages.every((image) => catalogImageUrl(image, "https://example.supabase.co"))
    );
    if (!valid) {
      manualValid = false;
      add("critical", row.slug, "admin_only_invalid", "publishable active product", "invalid taxonomy or primary image");
    } else {
      add("expected", row.slug, "admin_only", "managed outside static catalog", row.is_active ? "published" : "draft");
    }
  }
  if (!manualValid) add("critical", manualBaseline?.slug ?? "admin_only", "manual_product", "valid admin-only products", "mismatch");
  add("informational", "catalog", "database_metadata", "not compared", "UUIDs and timestamps");

  images.sharedPaths = Array.from(sourcePaths.entries())
    .filter(([, count]) => count > 1)
    .map(([imagePath]) => imagePath)
    .sort();
  alliances.inconsistencies = differences.filter(
    (difference) => difference.severity === "critical" &&
      staticProducts.some((product) => product.slug === difference.slug && product.category === "Alianças")
  );
  const taxonomyFields = (field: string) => differences.filter(
    (difference) => difference.severity === "critical" && difference.field === field
  ).length;

  return {
    staticCount: staticProducts.length,
    databaseLegacyCount: legacy.length,
    adminOnlyCount: manualProducts.length,
    matchedCount,
    missingInDb: missingInDb.sort(),
    extraInDb: extraInDb.sort(),
    differences,
    prices,
    status: {
      active: legacy.filter((row) => row.is_active).length,
      inactive: legacy.filter((row) => !row.is_active).length,
      madeToOrder: legacy.filter((row) => row.stock_status === "made_to_order").length,
      customOrder: legacy.filter((row) => row.is_custom_order).length
    },
    images,
    alliances,
    taxonomy: {
      categories: database.categories.length,
      subcategories: database.subcategories.length,
      materials: database.materials.length,
      categoryDifferences: taxonomyFields("category_id"),
      subcategoryDifferences: taxonomyFields("subcategory_id"),
      materialDifferences: taxonomyFields("material_id")
    },
    manual: {
      valid: manualValid,
      slug: manual?.slug ?? null,
      imageCount: images.manualImages,
      baselineChecked: Boolean(manualBaseline)
    }
  };
}

export function shadowMetrics(result: ShadowResult) {
  return {
    static_count: result.staticCount,
    database_legacy_count: result.databaseLegacyCount,
    matched_count: result.matchedCount,
    critical_diff_count: result.differences.filter((difference) => difference.severity === "critical").length,
    expected_diff_count: result.differences.filter((difference) => difference.severity === "expected").length,
    missing_in_db_count: result.missingInDb.length,
    extra_in_db_count: result.extraInDb.length
  };
}
