import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Product } from "../types/product";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = path.join(ROOT_DIR, "data", "products.ts");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const REPORT_PATH = path.join(ROOT_DIR, "docs", "product-migration-dry-run.md");
const BEFORE_APPLY_REPORT_PATH = path.join(ROOT_DIR, "docs", "product-migration-before-apply.md");
const DEFAULT_APPLY_SQL_PATH = path.join(ROOT_DIR, ".tmp-product-migration-apply.sql");
const VALID_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APPLY_PAYLOAD_DELIMITER = "$marjouxs_catalog_payload$";
const APPLY_SNAPSHOT_DELIMITER = "$marjouxs_catalog_snapshot$";

export type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type SubcategoryRow = TaxonomyRow & {
  category_id: string;
};

export type ExistingProductRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  slug: string;
  is_active: boolean;
};

export type DatabaseSnapshot = {
  visibility: "service-role" | "sql-snapshot" | "public-anon";
  categories: TaxonomyRow[];
  subcategories: SubcategoryRow[];
  materials: TaxonomyRow[];
  products: ExistingProductRow[];
  counts: {
    products: number;
    images: number;
  };
};

export type TargetProductRow = {
  legacy_id: string;
  name: string;
  slug: string;
  category_id: string | null;
  subcategory_id: string | null;
  material_id: string | null;
  price: string | null;
  old_price: string | null;
  discount_percent: string | null;
  cash_discount_percent: string | null;
  installments_count: number | null;
  price_label_override: string | null;
  installments_text_override: string | null;
  short_description: null;
  description: string;
  tags: string[];
  stock_status: "available" | "made_to_order" | "unavailable" | "service";
  sale_unit: "unit" | "pair";
  is_custom_order: boolean;
  is_active: false;
  is_featured: boolean;
  allow_whatsapp_quote: boolean;
  engraving_available: boolean;
  engraving_included: boolean;
  jewelry_box_included: boolean;
  size_min: number | null;
  size_max: number | null;
  approximate_weight_grams: null;
  width_mm: null;
  thickness_mm: null;
  height_mm: null;
  length_cm: null;
  diameter_mm: null;
  finish: null;
  stone_type: null;
  stone_color: null;
  stone_quantity: null;
  material_details: null;
  gender_style: null;
  technical_notes: null;
  seo_title: null;
  seo_description: null;
};

export type TargetImageRow = {
  source_type: "local";
  path: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
};

export type ImageAudit = {
  valid: TargetImageRow[];
  placeholders: string[];
  missing: string[];
  invalid: Array<{ path: string; reason: string }>;
};

export type ProductPlan = {
  source: Product;
  row: TargetProductRow;
  images: TargetImageRow[];
  activationCandidate: boolean;
  action: "insert" | "already-present" | "conflict";
  issues: string[];
  warnings: string[];
  mappedCategory: TaxonomyRow | null;
  mappedSubcategory: SubcategoryRow | null;
  mappedMaterial: TaxonomyRow | null;
  imageAudit: ImageAudit;
};

export type SharedImage = {
  path: string;
  products: Array<{ legacyId: string; name: string; slug: string }>;
};

export type MigrationPlan = {
  generatedAt: string;
  sourceHash: string;
  products: ProductPlan[];
  database: DatabaseSnapshot;
  sourceDuplicateLegacyIds: string[];
  sourceDuplicateSlugs: string[];
  sharedImages: SharedImage[];
  manualProducts: ExistingProductRow[];
};

export type MigrationExecutionMode = "dry-run" | "apply";

type FileProbe = (absolutePath: string) => Promise<boolean>;

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function formatList(values: string[]) {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "Nenhum";
}

function groupDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function uniqueByName<T extends { name: string }>(rows: T[], name: string) {
  const normalized = normalizeLookup(name);
  const matches = rows.filter((row) => normalizeLookup(row.name) === normalized);
  return {
    row: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1
  };
}

export function toExactDecimal(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) throw new Error("valor não finito");

  const source = String(value);
  const match = source.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`valor fora da escala decimal: ${source}`);

  return `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}`;
}

function decimalMinorUnits(value: string) {
  const [integer, fraction = "00"] = value.split(".");
  return Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
}

function mapDecimalField(
  value: number | null | undefined,
  label: string,
  issues: string[],
  options: { allowZero?: boolean; max?: number } = {}
) {
  if (value === null || value === undefined) return null;

  try {
    const decimal = toExactDecimal(value);
    if (!decimal) return null;
    const minorUnits = decimalMinorUnits(decimal);
    if ((!options.allowZero && minorUnits <= 0) || (options.allowZero && minorUnits < 0)) {
      issues.push(`${label}: deve ser positivo`);
    }
    if (options.max !== undefined && Number(decimal) > options.max) {
      issues.push(`${label}: excede ${options.max}`);
    }
    return decimal;
  } catch (error) {
    issues.push(`${label}: ${(error as Error).message}`);
    return null;
  }
}

function isPlaceholderImage(imagePath: string) {
  return normalizeLookup(imagePath).includes("placeholder");
}

async function defaultFileProbe(absolutePath: string) {
  try {
    return (await stat(absolutePath)).isFile();
  } catch {
    return false;
  }
}

export async function inspectLegacyProductImages(
  product: Product,
  publicDir = PUBLIC_DIR,
  fileProbe: FileProbe = defaultFileProbe
): Promise<ImageAudit> {
  const audit: ImageAudit = { valid: [], placeholders: [], missing: [], invalid: [] };
  const resolvedPublicDir = path.resolve(publicDir);

  for (const rawPath of product.images) {
    const imagePath = rawPath.trim().replace(/\\/g, "/");
    if (isPlaceholderImage(imagePath)) {
      audit.placeholders.push(imagePath);
      continue;
    }

    if (!imagePath.startsWith("/produtos/")) {
      audit.invalid.push({ path: imagePath, reason: "fora de /produtos" });
      continue;
    }

    if (!VALID_IMAGE_EXTENSIONS.has(path.posix.extname(imagePath).toLowerCase())) {
      audit.invalid.push({ path: imagePath, reason: "extensão não suportada" });
      continue;
    }

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(imagePath);
    } catch {
      audit.invalid.push({ path: imagePath, reason: "caminho URL inválido" });
      continue;
    }

    const absolutePath = path.resolve(resolvedPublicDir, decodedPath.replace(/^\/+/, ""));
    if (!absolutePath.startsWith(`${resolvedPublicDir}${path.sep}`)) {
      audit.invalid.push({ path: imagePath, reason: "caminho fora de public" });
      continue;
    }

    if (!(await fileProbe(absolutePath))) {
      audit.missing.push(imagePath);
      continue;
    }

    audit.valid.push({
      source_type: "local",
      path: imagePath,
      alt_text: product.name,
      sort_order: audit.valid.length,
      is_primary: audit.valid.length === 0
    });
  }

  return audit;
}

function getMappedStockStatus(product: Product) {
  if (product.category === "Serviços" || product.stockStatus === "Serviço") return "service" as const;
  if (product.stockStatus === "Indisponível") return "unavailable" as const;
  if (isEffectivelyCustomOrder(product)) return "made_to_order" as const;

  return "available" as const;
}

export function isEffectivelyCustomOrder(product: Product) {
  if (product.stockStatus === "Indisponível" || product.stockStatus === "Serviço") return false;
  return (
    product.isCustomOrder ||
    product.stockStatus === "Sob encomenda" ||
    normalizeLookup(product.description).includes("sob encomenda")
  );
}

export function mapLegacyProduct(
  product: Product,
  database: DatabaseSnapshot,
  imageAudit: ImageAudit
): ProductPlan {
  const issues: string[] = [];
  const warnings: string[] = [];
  const categoryMatch = uniqueByName(database.categories, product.category);
  const category = categoryMatch.row;

  if (categoryMatch.ambiguous) issues.push(`categoria ambígua: ${product.category}`);
  else if (!category) issues.push(`categoria sem destino: ${product.category}`);

  const subcategoryRows = category
    ? database.subcategories.filter((row) => row.category_id === category.id)
    : [];
  const subcategoryMatch = uniqueByName(subcategoryRows, product.subcategory);
  const subcategory = subcategoryMatch.row;
  if (subcategoryMatch.ambiguous) issues.push(`subcategoria ambígua: ${product.subcategory}`);
  else if (!subcategory) issues.push(`subcategoria sem destino: ${product.subcategory}`);

  const materialMatch = uniqueByName(database.materials, product.material);
  const material = materialMatch.row;
  if (materialMatch.ambiguous) issues.push(`material ambíguo: ${product.material}`);
  else if (!material) issues.push(`material sem destino: ${product.material}`);

  if (!product.id.trim()) issues.push("legacy_id vazio");
  if (!product.name.trim()) issues.push("nome vazio");
  if (!PRODUCT_SLUG_PATTERN.test(product.slug)) issues.push(`slug inválido: ${product.slug}`);

  const price = mapDecimalField(product.price, "preço", issues);
  const oldPrice = mapDecimalField(product.oldPrice, "preço anterior", issues);
  const discountPercent = mapDecimalField(
    product.discountPercent,
    "desconto",
    issues,
    { allowZero: true, max: 100 }
  );
  const cashDiscountPercent = mapDecimalField(
    product.cashDiscountPercent,
    "desconto à vista",
    issues,
    { allowZero: true, max: 100 }
  );

  if (
    product.installmentsCount !== null &&
    product.installmentsCount !== undefined &&
    (!Number.isInteger(product.installmentsCount) ||
      product.installmentsCount < 1 ||
      product.installmentsCount > 24)
  ) {
    issues.push(`parcelas inválidas: ${product.installmentsCount}`);
  }

  if (imageAudit.placeholders.length > 0) warnings.push("imagem placeholder; produto deve permanecer inativo");
  if (imageAudit.missing.length > 0) warnings.push("arquivo de imagem ausente; produto deve permanecer inativo");
  if (imageAudit.invalid.length > 0) warnings.push("caminho de imagem inválido; produto deve permanecer inativo");
  if (imageAudit.valid.length === 0 && imageAudit.placeholders.length === 0 && imageAudit.missing.length === 0 && imageAudit.invalid.length === 0) {
    warnings.push("produto sem imagem; deve permanecer inativo");
  }

  const alliance = product.category === "Alianças";
  const normalizedDescription = normalizeLookup(product.description);
  const engravingMentioned = normalizedDescription.includes("gravacao");
  const includedMentioned = normalizedDescription.includes("inclus");
  const boxMentioned = normalizedDescription.includes("caixinha") || normalizedDescription.includes("caixa");
  const stockStatus = getMappedStockStatus(product);
  const taxonomyActive = Boolean(
    category?.is_active && subcategory?.is_active && material?.is_active
  );
  const activationCandidate = Boolean(
    imageAudit.valid.length > 0 &&
      taxonomyActive &&
      stockStatus !== "unavailable" &&
      stockStatus !== "service" &&
      issues.length === 0
  );

  if (category && !category.is_active) warnings.push(`categoria inativa: ${category.name}`);
  if (subcategory && !subcategory.is_active) warnings.push(`subcategoria inativa: ${subcategory.name}`);
  if (material && !material.is_active) warnings.push(`material inativo: ${material.name}`);

  return {
    source: product,
    row: {
      legacy_id: product.id,
      name: product.name,
      slug: product.slug,
      category_id: category?.id ?? null,
      subcategory_id: subcategory?.id ?? null,
      material_id: material?.id ?? null,
      price,
      old_price: oldPrice,
      discount_percent: discountPercent,
      cash_discount_percent: cashDiscountPercent,
      installments_count: product.installmentsCount ?? null,
      price_label_override: product.priceLabel || null,
      installments_text_override: product.installments || null,
      short_description: null,
      description: product.description,
      tags: [...(product.tags ?? [])],
      stock_status: stockStatus,
      sale_unit: alliance ? "pair" : "unit",
      is_custom_order: product.isCustomOrder,
      is_active: false,
      is_featured: product.featured,
      allow_whatsapp_quote: product.allowWhatsappQuote,
      engraving_available: alliance || engravingMentioned,
      engraving_included: alliance || (engravingMentioned && includedMentioned),
      jewelry_box_included: alliance || (boxMentioned && includedMentioned),
      size_min: alliance ? 8 : null,
      size_max: alliance ? 35 : null,
      approximate_weight_grams: null,
      width_mm: null,
      thickness_mm: null,
      height_mm: null,
      length_cm: null,
      diameter_mm: null,
      finish: null,
      stone_type: null,
      stone_color: null,
      stone_quantity: null,
      material_details: null,
      gender_style: null,
      technical_notes: null,
      seo_title: null,
      seo_description: null
    },
    images: imageAudit.valid,
    activationCandidate,
    action: "insert",
    issues,
    warnings,
    mappedCategory: category,
    mappedSubcategory: subcategory,
    mappedMaterial: material,
    imageAudit
  };
}

function collectSharedImages(products: ProductPlan[]) {
  const byPath = new Map<string, SharedImage["products"]>();
  for (const product of products) {
    for (const image of product.images) {
      const entries = byPath.get(image.path) ?? [];
      entries.push({
        legacyId: product.row.legacy_id,
        name: product.row.name,
        slug: product.row.slug
      });
      byPath.set(image.path, entries);
    }
  }

  return Array.from(byPath.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([imagePath, entries]) => ({ path: imagePath, products: entries }))
    .sort((left, right) => left.path.localeCompare(right.path, "pt-BR"));
}

export function buildMigrationPlan(
  sourceProducts: Product[],
  database: DatabaseSnapshot,
  imageAudits: Map<string, ImageAudit>,
  sourceHash = "test-source"
): MigrationPlan {
  const duplicateLegacyIds = groupDuplicates(sourceProducts.map((product) => product.id));
  const duplicateSlugs = groupDuplicates(sourceProducts.map((product) => product.slug));
  const existingByLegacyId = new Map(
    database.products
      .filter((product): product is ExistingProductRow & { legacy_id: string } => Boolean(product.legacy_id))
      .map((product) => [product.legacy_id, product])
  );
  const existingBySlug = new Map(database.products.map((product) => [product.slug, product]));

  const plans = sourceProducts.map((source) => {
    const plan = mapLegacyProduct(
      source,
      database,
      imageAudits.get(source.id) ?? { valid: [], placeholders: [], missing: [], invalid: [] }
    );

    if (duplicateLegacyIds.includes(source.id)) {
      plan.issues.push(`legacy_id duplicado na fonte: ${source.id}`);
      plan.action = "conflict";
    }
    if (duplicateSlugs.includes(source.slug)) {
      plan.issues.push(`slug duplicado na fonte: ${source.slug}`);
      plan.action = "conflict";
    }

    const existingLegacy = existingByLegacyId.get(source.id);
    const existingSlug = existingBySlug.get(source.slug);
    if (existingLegacy) {
      if (existingLegacy.slug === source.slug) {
        plan.action = "already-present";
        plan.warnings.push("legacy_id já existe; futura execução deve atualizar idempotentemente");
      } else {
        plan.action = "conflict";
        plan.issues.push(
          `legacy_id já existe com outro slug: ${existingLegacy.slug}`
        );
      }
    } else if (existingSlug) {
      plan.action = "conflict";
      plan.issues.push(
        existingSlug.legacy_id
          ? `slug já pertence a outro legacy_id: ${existingSlug.legacy_id}`
          : "slug conflita com produto administrativo manual"
      );
    }

    if (plan.issues.length > 0) plan.activationCandidate = false;
    return plan;
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceHash,
    products: plans,
    database,
    sourceDuplicateLegacyIds: duplicateLegacyIds,
    sourceDuplicateSlugs: duplicateSlugs,
    sharedImages: collectSharedImages(plans),
    manualProducts: database.products.filter((product) => product.legacy_id === null)
  };
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "pt-BR"));
}

function reportIssueList(title: string, plans: ProductPlan[], matcher: RegExp) {
  const affected = plans.filter((plan) => plan.issues.some((issue) => matcher.test(issue)));
  const lines = [`### ${title}`, ""];
  if (affected.length === 0) return [...lines, "Nenhum.", ""].join("\n");
  for (const plan of affected) {
    lines.push(`- \`${plan.row.legacy_id}\` / \`${plan.row.slug}\`: ${plan.issues.filter((issue) => matcher.test(issue)).join("; ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

function tableFromCounts(rows: Array<[string, number]>) {
  if (rows.length === 0) return "Nenhum.";
  return [
    "| Valor legado | Produtos |",
    "| --- | ---: |",
    ...rows.map(([value, count]) => `| ${value} | ${count} |`)
  ].join("\n");
}

function priceSummary(plans: ProductPlan[]) {
  const prices = plans
    .map((plan) => plan.row.price)
    .filter((price): price is string => price !== null)
    .sort((left, right) => decimalMinorUnits(left) - decimalMinorUnits(right));
  return {
    withPrice: prices.length,
    withoutPrice: plans.length - prices.length,
    minimum: prices[0] ?? null,
    maximum: prices.at(-1) ?? null
  };
}

function formatMoney(decimal: string | null) {
  if (!decimal) return "Não aplicável";
  const [integer, fraction] = decimal.split(".");
  return `R$ ${Number(integer).toLocaleString("pt-BR")},${fraction}`;
}

export function renderMigrationReport(
  plan: MigrationPlan,
  afterCounts: DatabaseSnapshot["counts"] = plan.database.counts
) {
  const products = plan.products;
  const valid = products.filter((product) => product.issues.length === 0);
  const problematic = products.filter((product) => product.issues.length > 0);
  const insertable = products.filter((product) => product.action === "insert" && product.issues.length === 0);
  const alreadyPresent = products.filter((product) => product.action === "already-present");
  const conflicts = products.filter((product) => product.action === "conflict");
  const activeCandidates = products.filter((product) => product.activationCandidate);
  const inactiveCandidates = products.filter((product) => !product.activationCandidate);
  const withoutPrice = products.filter((product) => product.row.price === null);
  const structuredMadeToOrder = products.filter(
    (product) => product.source.stockStatus === "Sob encomenda"
  );
  const structuredCustomOrders = products.filter((product) => product.source.isCustomOrder);
  const effectiveCustomOrders = products.filter((product) => isEffectivelyCustomOrder(product.source));
  const mappedMadeToOrder = products.filter(
    (product) => product.row.stock_status === "made_to_order"
  );
  const structuredAvailable = products.filter(
    (product) => product.source.stockStatus === "Disponível"
  );
  const mappedAvailable = products.filter((product) => product.row.stock_status === "available");
  const featured = products.filter((product) => product.row.is_featured);
  const validImageProducts = products.filter((product) => product.images.length > 0);
  const multipleImageProducts = products.filter((product) => product.source.images.length > 1);
  const placeholderProducts = products.filter((product) => product.imageAudit.placeholders.length > 0);
  const missingImageProducts = products.filter((product) => product.imageAudit.missing.length > 0);
  const invalidImageProducts = products.filter((product) => product.imageAudit.invalid.length > 0);
  const prices = priceSummary(products);
  const unchanged =
    plan.database.counts.products === afterCounts.products &&
    plan.database.counts.images === afterCounts.images;

  const sharedImageLines = plan.sharedImages.length === 0
    ? ["Nenhum."]
    : plan.sharedImages.flatMap((shared) => [
        `- \`${shared.path}\``,
        ...shared.products.map((product) => `  - \`${product.legacyId}\` (${product.name})`),
        "  - Seguro no modelo novo: sim. Cada produto terá sua própria linha de metadados apontando para o mesmo arquivo local; o arquivo físico não será duplicado."
      ]);

  const manualLines = plan.manualProducts.length === 0
    ? ["Nenhum produto administrativo manual foi encontrado no snapshot."]
    : plan.manualProducts.map(
        (product) => `- \`${product.slug}\` (${product.name}), ativo: ${product.is_active ? "sim" : "não"}, \`legacy_id = null\`.`
      );

  const categoryRows = countBy(products, (product) => product.source.category);
  const subcategoryRows = countBy(products, (product) => product.source.subcategory);
  const materialRows = countBy(products, (product) => product.source.material);

  return `# Dry-run da migração do catálogo legado

Gerado em: ${plan.generatedAt}

Fonte: \`data/products.ts\`  
SHA-256 da fonte: \`${plan.sourceHash}\`  
Modo: **somente leitura / dry-run**  
Visibilidade do snapshot do banco: \`${plan.database.visibility}\`

## Garantias desta execução

- Nenhum \`insert\`, \`update\`, \`upsert\` ou \`delete\` foi executado.
- Nenhum upload, cópia ou remoção foi feito no Supabase Storage.
- Todo produto futuro começa com \`is_active = false\`.
- Imagens válidas foram apenas mapeadas como \`source_type = local\`.
- O prazo global de 3 a 5 dias úteis não foi duplicado nos produtos.
- \`data/products.ts\` continua sendo a fonte pública do ecommerce.

## Total

| Métrica | Quantidade |
| --- | ---: |
| Produtos no catálogo estático | ${products.length} |
| Legacy IDs únicos | ${new Set(products.map((product) => product.row.legacy_id)).size} |
| Slugs únicos | ${new Set(products.map((product) => product.row.slug)).size} |
| Produtos novos que seriam inseridos | ${insertable.length} |
| Produtos já reconhecidos por \`legacy_id\` | ${alreadyPresent.length} |
| Produtos válidos para migração | ${valid.length} |
| Produtos com bloqueio | ${problematic.length} |
| Conflitos com registros existentes | ${conflicts.length} |

## Status comercial

| Métrica | Quantidade |
| --- | ---: |
| Candidatos à ativação após imagem/validação | ${activeCandidates.length} |
| Candidatos a permanecer inativos | ${inactiveCandidates.length} |
| Com preço | ${prices.withPrice} |
| Sem preço | ${prices.withoutPrice} |
| Sob encomenda no campo estruturado legado | ${structuredMadeToOrder.length} |
| \`isCustomOrder = true\` no legado | ${structuredCustomOrders.length} |
| Sob encomenda efetivo pela regra pública atual | ${effectiveCustomOrders.length} |
| \`stock_status = made_to_order\` no destino | ${mappedMadeToOrder.length} |
| Disponíveis no campo estruturado legado | ${structuredAvailable.length} |
| \`stock_status = available\` no destino | ${mappedAvailable.length} |
| Em destaque | ${featured.length} |

Todos os ${products.length} registros de produto foram planejados inicialmente com \`is_active = false\`. A coluna “candidato à ativação” representa apenas o estado final pretendido depois da inserção da imagem principal e das validações.

A diferença entre o campo estruturado e a classificação efetiva ocorre porque a regra pública atual também reconhece frases reais como “sob encomenda” na descrição. A migração preserva \`is_custom_order\` exclusivamente a partir de \`isCustomOrder\`; o texto continua integral na descrição, sem virar dado estruturado. Produtos de Serviços permanecem com \`stock_status = service\`.

## Preços

- Menor preço: ${formatMoney(prices.minimum)}.
- Maior preço: ${formatMoney(prices.maximum)}.
- Persistência futura preparada como texto decimal exato com duas casas, sem cálculo em ponto flutuante.
- Valores inválidos: ${products.filter((product) => product.issues.some((issue) => issue.startsWith("preço"))).length}.

## Taxonomia

### Categorias

${tableFromCounts(categoryRows)}

### Subcategorias

${tableFromCounts(subcategoryRows)}

### Materiais

${tableFromCounts(materialRows)}

- Categorias não mapeadas/ambíguas: ${products.filter((product) => product.issues.some((issue) => issue.startsWith("categoria"))).length}.
- Subcategorias não mapeadas/ambíguas: ${products.filter((product) => product.issues.some((issue) => issue.startsWith("subcategoria"))).length}.
- Materiais não mapeados/ambíguos: ${products.filter((product) => product.issues.some((issue) => issue.startsWith("material"))).length}.
- \`Serviços\` permanece vinculado à taxonomia inativa e nunca é candidato à ativação pública.
- \`Prata\`, \`Prata 925\` e \`Prata 950\` são tratados como materiais distintos.

## Alianças

- Venda futura por \`pair\`, nunca por unidade.
- Faixa de aros preservada em 8 a 35.
- Gravação disponível e inclusa; caixinha inclusa, conforme o comportamento comercial já existente.
- Produtos sob encomenda permanecem classificados como \`made_to_order\`.
- Nenhum prazo de confecção foi gravado por produto.

## Imagens

| Métrica | Quantidade |
| --- | ---: |
| Produtos com imagem local válida | ${validImageProducts.length} |
| Registros futuros de imagem válidos | ${products.reduce((total, product) => total + product.images.length, 0)} |
| Produtos com múltiplas imagens no legado | ${multipleImageProducts.length} |
| Produtos com placeholder | ${placeholderProducts.length} |
| Produtos com arquivo ausente | ${missingImageProducts.length} |
| Produtos com caminho/extensão inválido | ${invalidImageProducts.length} |
| Arquivos compartilhados por produtos | ${plan.sharedImages.length} |

Para cada imagem válida: \`source_type = local\`, \`is_primary = true\` na primeira imagem e \`sort_order = 0\`. Placeholders não geram imagem fictícia.

### Arquivos compartilhados

${sharedImageLines.join("\n")}

## Registros já existentes no banco

- Produtos antes do dry-run: ${plan.database.counts.products}.
- Imagens antes do dry-run: ${plan.database.counts.images}.
- Produtos depois do dry-run: ${afterCounts.products}.
- Imagens depois do dry-run: ${afterCounts.images}.
- Contagens inalteradas: ${unchanged ? "sim" : "NÃO"}.

### Produtos administrativos manuais

${manualLines.join("\n")}

Esses registros são diferenciados por \`legacy_id = null\`, não são tratados como legado e não são alterados pelo plano.

## Conflitos

- Legacy IDs duplicados na fonte: ${formatList(plan.sourceDuplicateLegacyIds)}.
- Slugs duplicados na fonte: ${formatList(plan.sourceDuplicateSlugs)}.
- Conflitos com o banco: ${conflicts.length}.

${reportIssueList("Slug e legacy_id", products, /slug|legacy_id/)}
${reportIssueList("Categoria e subcategoria", products, /categoria|subcategoria/)}
${reportIssueList("Material", products, /material/)}
${reportIssueList("Preço", products, /preço|desconto|parcelas/)}

## Idempotência do apply

O plano usa \`legacy_id\` como identidade do catálogo estático. No modo explícito \`--apply\`:

1. procurar o registro pelo \`legacy_id\`;
2. inserir como inativo quando não existir;
3. atualizar idempotentemente quando o mesmo \`legacy_id\` já existir;
4. bloquear e relatar conflito quando o slug pertencer a um produto manual ou a outro \`legacy_id\`;
5. registrar a imagem principal local;
6. validar e somente então ativar os candidatos.

Uma segunda execução não cria duplicatas. O dry-run permanece como padrão; o apply gera uma transação única, com guardas contra snapshot desatualizado e sem resolução automática de conflito.
`;
}

function applyPlanMetrics(plan: MigrationPlan) {
  const products = plan.products;
  return {
    total: products.length,
    legacyIds: new Set(products.map((product) => product.row.legacy_id)).size,
    slugs: new Set(products.map((product) => product.row.slug)).size,
    active: products.filter((product) => product.activationCandidate).length,
    inactive: products.filter((product) => !product.activationCandidate).length,
    images: products.reduce((total, product) => total + product.images.length, 0),
    placeholders: products.filter((product) => product.imageAudit.placeholders.length > 0).length,
    withPrice: products.filter((product) => product.row.price !== null).length,
    withoutPrice: products.filter((product) => product.row.price === null).length,
    structuredCustomOrders: products.filter((product) => product.source.isCustomOrder).length,
    structuredMadeToOrder: products.filter(
      (product) => product.source.stockStatus === "Sob encomenda"
    ).length,
    effectiveCustomOrders: products.filter((product) =>
      isEffectivelyCustomOrder(product.source)
    ).length,
    mappedMadeToOrder: products.filter(
      (product) => product.row.stock_status === "made_to_order"
    ).length,
    conflicts: products.filter(
      (product) => product.action === "conflict" || product.issues.length > 0
    ).length
  };
}

export function assertPlanReadyForApply(plan: MigrationPlan) {
  const metrics = applyPlanMetrics(plan);
  const existingLegacyProducts = plan.database.products.filter(
    (product) => product.legacy_id !== null
  );
  const expectedManualProduct = plan.manualProducts.find(
    (product) => product.slug === "anel-feminino"
  );

  if (plan.database.visibility === "public-anon") {
    throw new Error("O apply exige snapshot SQL completo ou service role; anon não é suficiente.");
  }
  if (metrics.total !== 400 || metrics.legacyIds !== 400 || metrics.slugs !== 400) {
    throw new Error(
      `Catálogo inesperado: total=${metrics.total}, legacy_ids=${metrics.legacyIds}, slugs=${metrics.slugs}.`
    );
  }
  if (metrics.conflicts > 0 || plan.sourceDuplicateLegacyIds.length > 0 || plan.sourceDuplicateSlugs.length > 0) {
    throw new Error(`Apply bloqueado por ${metrics.conflicts} conflito(s) no plano.`);
  }
  if (![0, 400].includes(existingLegacyProducts.length)) {
    throw new Error(
      `Estado parcial inesperado: ${existingLegacyProducts.length} legacy_id já existem; esperado 0 ou 400.`
    );
  }
  if (plan.manualProducts.length !== 1 || !expectedManualProduct) {
    throw new Error("O produto administrativo manual anel-feminino não corresponde ao snapshot aprovado.");
  }
  if (metrics.active !== 387 || metrics.inactive !== 13 || metrics.images !== 387) {
    throw new Error(
      `Paridade de ativação/imagens inesperada: ativos=${metrics.active}, inativos=${metrics.inactive}, imagens=${metrics.images}.`
    );
  }
  if (metrics.placeholders !== 13 || metrics.withPrice !== 396 || metrics.withoutPrice !== 4) {
    throw new Error(
      `Paridade do catálogo inesperada: placeholders=${metrics.placeholders}, com_preço=${metrics.withPrice}, sem_preço=${metrics.withoutPrice}.`
    );
  }
  if (
    metrics.structuredCustomOrders !== 61 ||
    metrics.structuredMadeToOrder !== 63 ||
    metrics.effectiveCustomOrders !== 134 ||
    metrics.mappedMadeToOrder !== 132
  ) {
    throw new Error(
      `Paridade de encomenda inesperada: isCustomOrder=${metrics.structuredCustomOrders}, stockStatus=${metrics.structuredMadeToOrder}, efetivo=${metrics.effectiveCustomOrders}, destino=${metrics.mappedMadeToOrder}.`
    );
  }
  if (
    plan.products.some(
      (product) =>
        product.row.is_active !== false ||
        product.images.some((image) => image.source_type !== "local")
    )
  ) {
    throw new Error("O plano contém produto inicialmente ativo ou imagem que não é local.");
  }

  return metrics;
}

export function renderBeforeApplyReport(plan: MigrationPlan) {
  const metrics = assertPlanReadyForApply(plan);
  const legacyIds = plan.database.products
    .map((product) => product.legacy_id)
    .filter((legacyId): legacyId is string => legacyId !== null)
    .sort((left, right) => left.localeCompare(right));
  const manualLines = plan.manualProducts.map(
    (product) =>
      `- \`${product.slug}\` (${product.name}), id \`${product.id}\`, ativo: ${product.is_active ? "sim" : "não"}, \`legacy_id = null\`.`
  );
  const taxonomyLines = (rows: TaxonomyRow[]) =>
    rows.map(
      (row) => `- \`${row.slug}\` (${row.name}), id \`${row.id}\`, ativo: ${row.is_active ? "sim" : "não"}.`
    );

  return `# Snapshot anterior à migração real do catálogo

Gerado em: ${plan.generatedAt}

Fonte: \`data/products.ts\`  
SHA-256 da fonte: \`${plan.sourceHash}\`  
Visibilidade: \`${plan.database.visibility}\`  
Modo solicitado: **apply explícito**

## Contagens antes

- Produtos em \`ecommerce_products\`: ${plan.database.counts.products}.
- Imagens em \`ecommerce_product_images\`: ${plan.database.counts.images}.
- Legacy IDs existentes: ${legacyIds.length}.
- Produtos administrativos manuais: ${plan.manualProducts.length}.

## Legacy IDs existentes

${legacyIds.length > 0 ? legacyIds.map((legacyId) => `- \`${legacyId}\``).join("\n") : "Nenhum."}

## Produto administrativo manual

${manualLines.join("\n")}

O SQL transacional captura a linha completa e suas imagens antes do upsert e aborta se qualquer campo manual mudar.

## Categorias (${plan.database.categories.length})

${taxonomyLines(plan.database.categories).join("\n")}

## Subcategorias (${plan.database.subcategories.length})

${plan.database.subcategories
  .map(
    (row) =>
      `- \`${row.slug}\` (${row.name}), id \`${row.id}\`, categoria \`${row.category_id}\`, ativo: ${row.is_active ? "sim" : "não"}.`
  )
  .join("\n")}

## Materiais (${plan.database.materials.length})

${taxonomyLines(plan.database.materials).join("\n")}

## Paridade esperada

- Produtos legados: ${metrics.total}.
- Candidatos ativos após imagem e validação: ${metrics.active}.
- Legados inativos: ${metrics.inactive}.
- Imagens locais principais: ${metrics.images}.
- Produtos com preço: ${metrics.withPrice}.
- Produtos sem preço: ${metrics.withoutPrice}.
- \`is_custom_order = true\` a partir do campo real \`isCustomOrder\`: ${metrics.structuredCustomOrders}.
- Sob encomenda efetivo pela regra pública atual: ${metrics.effectiveCustomOrders}.
- \`stock_status = made_to_order\` no destino: ${metrics.mappedMadeToOrder}.
- Há ${metrics.effectiveCustomOrders - metrics.mappedMadeToOrder} itens de Serviços classificados como sob encomenda no legado; eles permanecem corretamente como \`stock_status = service\`.

Nenhum arquivo será enviado ao Storage. O site público continua usando \`data/products.ts\`.
`;
}

function toDollarQuotedJson(value: unknown, delimiter: string) {
  const json = JSON.stringify(value);
  if (json.includes(delimiter)) {
    throw new Error(`O payload contém o delimitador SQL reservado ${delimiter}.`);
  }
  return `${delimiter}${json}${delimiter}`;
}

const PRODUCT_MIGRATION_COLUMNS = [
  "legacy_id",
  "name",
  "slug",
  "category_id",
  "subcategory_id",
  "material_id",
  "price",
  "old_price",
  "discount_percent",
  "cash_discount_percent",
  "installments_count",
  "price_label_override",
  "installments_text_override",
  "short_description",
  "description",
  "tags",
  "stock_status",
  "sale_unit",
  "is_custom_order",
  "is_active",
  "is_featured",
  "allow_whatsapp_quote",
  "engraving_available",
  "engraving_included",
  "jewelry_box_included",
  "size_min",
  "size_max",
  "approximate_weight_grams",
  "width_mm",
  "thickness_mm",
  "height_mm",
  "length_cm",
  "diameter_mm",
  "finish",
  "stone_type",
  "stone_color",
  "stone_quantity",
  "material_details",
  "gender_style",
  "technical_notes",
  "seo_title",
  "seo_description"
] as const;

export function generateApplySql(plan: MigrationPlan) {
  const metrics = assertPlanReadyForApply(plan);
  const payload = plan.products.map((product) => ({
    row: product.row,
    images: product.images,
    activation_candidate: product.activationCandidate
  }));
  const snapshot = {
    counts: plan.database.counts,
    legacy_ids: plan.database.products
      .map((product) => product.legacy_id)
      .filter((legacyId): legacyId is string => legacyId !== null)
      .sort((left, right) => left.localeCompare(right)),
    manual_products: [...plan.manualProducts].sort(
      (left, right) => left.slug.localeCompare(right.slug) || left.id.localeCompare(right.id)
    ),
    categories: [...plan.database.categories].sort(
      (left, right) => left.slug.localeCompare(right.slug) || left.id.localeCompare(right.id)
    ),
    subcategories: [...plan.database.subcategories].sort(
      (left, right) => left.slug.localeCompare(right.slug) || left.id.localeCompare(right.id)
    ),
    materials: [...plan.database.materials].sort(
      (left, right) => left.slug.localeCompare(right.slug) || left.id.localeCompare(right.id)
    )
  };
  const productColumns = PRODUCT_MIGRATION_COLUMNS.join(",\n  ");
  const productSelect = PRODUCT_MIGRATION_COLUMNS.map((column) =>
    column === "is_active" ? "false" : `expected.${column}`
  ).join(",\n  ");
  const productUpdates = PRODUCT_MIGRATION_COLUMNS.filter((column) => column !== "legacy_id")
    .map((column) => `${column} = excluded.${column}`)
    .join(",\n  ");

  return `-- Gerado por scripts/migrate-products-to-supabase.ts --apply
-- Fonte SHA-256: ${plan.sourceHash}
-- Não envia arquivos ao Storage e não altera a fonte pública do catálogo.

begin;

drop table if exists pg_temp.marjouxs_migration_payload;
drop table if exists pg_temp.marjouxs_expected_snapshot;
drop table if exists pg_temp.marjouxs_manual_products_before;
drop table if exists pg_temp.marjouxs_manual_images_before;
drop table if exists pg_temp.marjouxs_legacy_before;
drop table if exists pg_temp.marjouxs_legacy_images_before;
drop table if exists pg_temp.marjouxs_expected_products;
drop table if exists pg_temp.marjouxs_expected_images;

create temporary table marjouxs_migration_payload (payload jsonb not null) on commit preserve rows;
insert into marjouxs_migration_payload (payload)
select value
from jsonb_array_elements(${toDollarQuotedJson(payload, APPLY_PAYLOAD_DELIMITER)}::jsonb);

create temporary table marjouxs_expected_snapshot (snapshot jsonb not null) on commit preserve rows;
insert into marjouxs_expected_snapshot (snapshot)
values (${toDollarQuotedJson(snapshot, APPLY_SNAPSHOT_DELIMITER)}::jsonb);

do $preflight$
declare
  expected jsonb := (select snapshot from marjouxs_expected_snapshot);
  current_json jsonb;
begin
  if (select count(*) from marjouxs_migration_payload) <> ${metrics.total} then
    raise exception 'migration payload count mismatch';
  end if;

  if (select count(*) from public.ecommerce_products) <> (expected #>> '{counts,products}')::integer
     or (select count(*) from public.ecommerce_product_images) <> (expected #>> '{counts,images}')::integer then
    raise exception 'database counts changed after the approved snapshot';
  end if;

  select coalesce(jsonb_agg(legacy_id order by legacy_id), '[]'::jsonb)
  into current_json
  from public.ecommerce_products
  where legacy_id is not null;
  if current_json <> expected->'legacy_ids' then
    raise exception 'legacy_id set changed after the approved snapshot';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'legacy_id', legacy_id,
        'name', name,
        'slug', slug,
        'is_active', is_active
      ) order by slug, id
    ),
    '[]'::jsonb
  )
  into current_json
  from public.ecommerce_products
  where legacy_id is null;
  if current_json <> expected->'manual_products' then
    raise exception 'manual products changed after the approved snapshot';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id::text, 'name', name, 'slug', slug, 'is_active', is_active)
      order by slug, id
    ),
    '[]'::jsonb
  )
  into current_json
  from public.ecommerce_categories;
  if current_json <> expected->'categories' then
    raise exception 'categories changed after the approved snapshot';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'category_id', category_id::text,
        'name', name,
        'slug', slug,
        'is_active', is_active
      ) order by slug, id
    ),
    '[]'::jsonb
  )
  into current_json
  from public.ecommerce_subcategories;
  if current_json <> expected->'subcategories' then
    raise exception 'subcategories changed after the approved snapshot';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id::text, 'name', name, 'slug', slug, 'is_active', is_active)
      order by slug, id
    ),
    '[]'::jsonb
  )
  into current_json
  from public.ecommerce_materials;
  if current_json <> expected->'materials' then
    raise exception 'materials changed after the approved snapshot';
  end if;

  if exists (
    select 1
    from marjouxs_migration_payload
    group by payload #>> '{row,legacy_id}'
    having count(*) > 1
  ) or exists (
    select 1
    from marjouxs_migration_payload
    group by payload #>> '{row,slug}'
    having count(*) > 1
  ) then
    raise exception 'duplicate legacy_id or slug in migration payload';
  end if;

  if exists (
    select 1
    from marjouxs_migration_payload source
    join public.ecommerce_products product
      on product.slug = source.payload #>> '{row,slug}'
    where product.legacy_id is distinct from source.payload #>> '{row,legacy_id}'
  ) then
    raise exception 'slug conflict with another or manual product';
  end if;

  if exists (
    select 1
    from marjouxs_migration_payload source
    join public.ecommerce_products product
      on product.legacy_id = source.payload #>> '{row,legacy_id}'
    where product.slug is distinct from source.payload #>> '{row,slug}'
  ) then
    raise exception 'legacy_id conflict with a different slug';
  end if;

  if exists (
    select 1
    from marjouxs_migration_payload source
    left join public.ecommerce_categories category
      on category.id = (source.payload #>> '{row,category_id}')::uuid
    left join public.ecommerce_materials material
      on material.id = (source.payload #>> '{row,material_id}')::uuid
    left join public.ecommerce_subcategories subcategory
      on subcategory.id = (source.payload #>> '{row,subcategory_id}')::uuid
     and subcategory.category_id = (source.payload #>> '{row,category_id}')::uuid
    where category.id is null or material.id is null or subcategory.id is null
  ) then
    raise exception 'taxonomy target missing or inconsistent';
  end if;

  if exists (
    select 1
    from public.ecommerce_product_images image
    join public.ecommerce_products product on product.id = image.product_id
    where product.legacy_id is not null
      and image.source_type <> 'local'
  ) then
    raise exception 'legacy product has non-local image metadata';
  end if;
end;
$preflight$;

create temporary table marjouxs_manual_products_before on commit preserve rows as
select id, to_jsonb(product) as payload
from public.ecommerce_products product
where legacy_id is null;

create temporary table marjouxs_manual_images_before on commit preserve rows as
select image.id, to_jsonb(image) as payload
from public.ecommerce_product_images image
join public.ecommerce_products product on product.id = image.product_id
where product.legacy_id is null;

create temporary table marjouxs_legacy_before on commit preserve rows as
select legacy_id
from public.ecommerce_products
where legacy_id is not null;

create temporary table marjouxs_legacy_images_before on commit preserve rows as
select image.product_id, image.path
from public.ecommerce_product_images image
join public.ecommerce_products product on product.id = image.product_id
where product.legacy_id is not null;

create temporary table marjouxs_expected_products on commit preserve rows as
select * from public.ecommerce_products where false;

insert into marjouxs_expected_products
select populated.*
from marjouxs_migration_payload source
cross join lateral jsonb_populate_record(
  null::public.ecommerce_products,
  (source.payload->'row') || jsonb_build_object(
    'is_active', (source.payload->>'activation_candidate')::boolean
  )
) populated;

insert into public.ecommerce_products (
  ${productColumns}
)
select
  ${productSelect}
from marjouxs_expected_products expected
on conflict (legacy_id) do update
set
  ${productUpdates};

create temporary table marjouxs_expected_images on commit preserve rows as
select * from public.ecommerce_product_images where false;

insert into marjouxs_expected_images
select populated.*
from marjouxs_migration_payload source
join public.ecommerce_products product
  on product.legacy_id = source.payload #>> '{row,legacy_id}'
cross join lateral jsonb_array_elements(source.payload->'images') image
cross join lateral jsonb_populate_record(
  null::public.ecommerce_product_images,
  image || jsonb_build_object('product_id', product.id)
) populated;

do $image_preflight$
begin
  if exists (
    select 1
    from public.ecommerce_product_images image
    join public.ecommerce_products product on product.id = image.product_id
    where product.legacy_id is not null
      and not exists (
        select 1
        from marjouxs_expected_images expected
        where expected.product_id = image.product_id
          and expected.path = image.path
      )
  ) then
    raise exception 'unexpected legacy image metadata; automatic deletion is disabled';
  end if;
end;
$image_preflight$;

insert into public.ecommerce_product_images (
  product_id,
  source_type,
  path,
  alt_text,
  sort_order,
  is_primary,
  width_px,
  height_px
)
select
  product_id,
  source_type,
  path,
  alt_text,
  sort_order,
  is_primary,
  width_px,
  height_px
from marjouxs_expected_images
on conflict (product_id, path) do update
set source_type = excluded.source_type,
    alt_text = excluded.alt_text,
    sort_order = excluded.sort_order,
    is_primary = excluded.is_primary,
    width_px = excluded.width_px,
    height_px = excluded.height_px;

update public.ecommerce_products product
set is_active = expected.is_active
from marjouxs_expected_products expected
where product.legacy_id = expected.legacy_id
  and product.is_active is distinct from expected.is_active;

do $parity$
begin
  if (select count(*) from public.ecommerce_products where legacy_id is not null) <> ${metrics.total} then
    raise exception 'final legacy product count mismatch';
  end if;
  if (select count(*) from public.ecommerce_products where legacy_id is not null and is_active) <> ${metrics.active}
     or (select count(*) from public.ecommerce_products where legacy_id is not null and not is_active) <> ${metrics.inactive} then
    raise exception 'final active/inactive count mismatch';
  end if;
  if (select count(*) from public.ecommerce_products where legacy_id is not null and price is null) <> ${metrics.withoutPrice} then
    raise exception 'final null-price count mismatch';
  end if;
  if (select count(*) from public.ecommerce_products where legacy_id is not null and is_custom_order) <> ${metrics.structuredCustomOrders} then
    raise exception 'final is_custom_order count mismatch';
  end if;
  if (select count(*) from public.ecommerce_products where legacy_id is not null and stock_status = 'made_to_order') <> ${metrics.mappedMadeToOrder} then
    raise exception 'final made_to_order count mismatch';
  end if;
  if (
    select count(*)
    from public.ecommerce_product_images image
    join public.ecommerce_products product on product.id = image.product_id
    where product.legacy_id is not null
  ) <> ${metrics.images} then
    raise exception 'final legacy image count mismatch';
  end if;
  if (
    select count(*)
    from public.ecommerce_product_images image
    join public.ecommerce_products product on product.id = image.product_id
    where product.legacy_id is not null and image.is_primary and image.source_type = 'local'
  ) <> ${metrics.images} then
    raise exception 'final local primary-image count mismatch';
  end if;
  if (
    select count(*)
    from public.ecommerce_product_images image
    join public.ecommerce_products product on product.id = image.product_id
    where product.legacy_id in ('aliancas-em-ouro-18k-tradicional', 'aliancas-ouro-18k-750-polida')
      and image.path = '/produtos/aliancas-ouro-18k-750-polida-3200.png'
  ) <> 2 then
    raise exception 'shared-image parity mismatch';
  end if;

  if exists (
    select 1
    from marjouxs_expected_products expected
    join public.ecommerce_products actual on actual.legacy_id = expected.legacy_id
    where (to_jsonb(actual) - array['id', 'version', 'created_at', 'updated_at', 'created_by', 'updated_by'])
       is distinct from
      (to_jsonb(expected) - array['id', 'version', 'created_at', 'updated_at', 'created_by', 'updated_by'])
  ) then
    raise exception 'final product field parity mismatch';
  end if;

  if exists (
    select 1
    from marjouxs_expected_images expected
    join public.ecommerce_product_images actual
      on actual.product_id = expected.product_id and actual.path = expected.path
    where (to_jsonb(actual) - array['id', 'created_at', 'updated_at', 'created_by'])
       is distinct from
      (to_jsonb(expected) - array['id', 'created_at', 'updated_at', 'created_by'])
  ) then
    raise exception 'final image field parity mismatch';
  end if;

  if exists (
    (select id, payload from marjouxs_manual_products_before
     except
     select id, to_jsonb(product) from public.ecommerce_products product where legacy_id is null)
    union all
    (select id, to_jsonb(product) from public.ecommerce_products product where legacy_id is null
     except
     select id, payload from marjouxs_manual_products_before)
  ) then
    raise exception 'manual product changed during migration';
  end if;

  if exists (
    (select id, payload from marjouxs_manual_images_before
     except
     select image.id, to_jsonb(image)
     from public.ecommerce_product_images image
     join public.ecommerce_products product on product.id = image.product_id
     where product.legacy_id is null)
    union all
    (select image.id, to_jsonb(image)
     from public.ecommerce_product_images image
     join public.ecommerce_products product on product.id = image.product_id
     where product.legacy_id is null
     except
     select id, payload from marjouxs_manual_images_before)
  ) then
    raise exception 'manual product image changed during migration';
  end if;
end;
$parity$;

commit;

select jsonb_build_object(
  'source_sha256', '${plan.sourceHash}',
  'products_before', (select (snapshot #>> '{counts,products}')::integer from marjouxs_expected_snapshot),
  'images_before', (select (snapshot #>> '{counts,images}')::integer from marjouxs_expected_snapshot),
  'legacy_inserted', (
    select count(*)
    from marjouxs_expected_products expected
    where not exists (
      select 1 from marjouxs_legacy_before before where before.legacy_id = expected.legacy_id
    )
  ),
  'legacy_updated', (
    select count(*)
    from marjouxs_expected_products expected
    where exists (
      select 1 from marjouxs_legacy_before before where before.legacy_id = expected.legacy_id
    )
  ),
  'legacy_total', (select count(*) from public.ecommerce_products where legacy_id is not null),
  'products_total', (select count(*) from public.ecommerce_products),
  'manual_products', (select count(*) from public.ecommerce_products where legacy_id is null),
  'legacy_active', (select count(*) from public.ecommerce_products where legacy_id is not null and is_active),
  'legacy_inactive', (select count(*) from public.ecommerce_products where legacy_id is not null and not is_active),
  'legacy_without_price', (select count(*) from public.ecommerce_products where legacy_id is not null and price is null),
  'legacy_images', (
    select count(*)
    from public.ecommerce_product_images image
    join public.ecommerce_products product on product.id = image.product_id
    where product.legacy_id is not null
  ),
  'images_inserted', (
    select count(*)
    from marjouxs_expected_images expected
    where not exists (
      select 1
      from marjouxs_legacy_images_before before
      where before.product_id = expected.product_id and before.path = expected.path
    )
  ),
  'images_total', (select count(*) from public.ecommerce_product_images),
  'manual_preserved', true,
  'storage_uploads', 0,
  'conflicts', 0
) as migration_result;
`;
}

export async function loadLegacyProducts(sourcePath = SOURCE_PATH) {
  const source = await readFile(sourcePath, "utf8");
  const marker = /export const products:\s*Product\[\]\s*=\s*/;
  const match = marker.exec(source);
  if (!match) throw new Error("Não foi possível localizar o array products em data/products.ts.");

  const json = source.slice((match.index ?? 0) + match[0].length).trim().replace(/;\s*$/, "");
  const products = JSON.parse(json) as Product[];
  if (!Array.isArray(products)) throw new Error("O catálogo legado não é um array.");

  return {
    products,
    hash: createHash("sha256").update(source).digest("hex")
  };
}

async function checkedQuery<T>(label: string, query: PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>) {
  const result = await query;
  if (result.error) {
    throw new Error(`${label}: ${result.error.code ?? "database_error"} ${result.error.message}`);
  }
  return result.data;
}

async function tableCount(supabase: SupabaseClient, table: string) {
  const result = await supabase.from(table).select("id", { count: "exact", head: true });
  if (result.error) throw new Error(`${table}: ${result.error.code ?? "database_error"} ${result.error.message}`);
  return result.count ?? 0;
}

export async function readDatabaseSnapshot(
  supabase: SupabaseClient,
  visibility: DatabaseSnapshot["visibility"]
): Promise<DatabaseSnapshot> {
  const [categories, subcategories, materials, products, productCount, imageCount] = await Promise.all([
    checkedQuery<TaxonomyRow[]>(
      "ecommerce_categories",
      supabase.from("ecommerce_categories").select("id,name,slug,is_active").order("slug")
    ),
    checkedQuery<SubcategoryRow[]>(
      "ecommerce_subcategories",
      supabase.from("ecommerce_subcategories").select("id,category_id,name,slug,is_active").order("slug")
    ),
    checkedQuery<TaxonomyRow[]>(
      "ecommerce_materials",
      supabase.from("ecommerce_materials").select("id,name,slug,is_active").order("slug")
    ),
    checkedQuery<ExistingProductRow[]>(
      "ecommerce_products",
      supabase.from("ecommerce_products").select("id,legacy_id,name,slug,is_active").order("slug")
    ),
    tableCount(supabase, "ecommerce_products"),
    tableCount(supabase, "ecommerce_product_images")
  ]);

  return {
    visibility,
    categories: categories ?? [],
    subcategories: subcategories ?? [],
    materials: materials ?? [],
    products: products ?? [],
    counts: { products: productCount, images: imageCount }
  };
}

export function assertCompleteDatabaseSnapshot(snapshot: DatabaseSnapshot) {
  const requiredCategories = ["Alianças", "Anéis", "Brincos", "Correntes", "Pulseiras", "Serviços"];
  const requiredMaterials = ["Ouro 18k", "Prata", "Prata 925", "Prata 950", "Semijoia", "Serviço técnico", "Zircônia"];
  const missingCategories = requiredCategories.filter(
    (name) => !snapshot.categories.some((row) => normalizeLookup(row.name) === normalizeLookup(name))
  );
  const missingMaterials = requiredMaterials.filter(
    (name) => !snapshot.materials.some((row) => normalizeLookup(row.name) === normalizeLookup(name))
  );

  if (missingCategories.length > 0 || missingMaterials.length > 0) {
    throw new Error(
      `Snapshot incompleto por RLS. Categorias ausentes: ${missingCategories.join(", ") || "nenhuma"}. Materiais ausentes: ${missingMaterials.join(", ") || "nenhum"}. Use service role local ou --snapshot.`
    );
  }
}

function createReadOnlySupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = serviceRole || anonKey;
  if (!url || !key) {
    throw new Error("Configure SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ou as variáveis públicas para executar o dry-run.");
  }

  return {
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }),
    visibility: serviceRole ? "service-role" as const : "public-anon" as const
  };
}

function parseSnapshotArgument(args: string[]) {
  const index = args.indexOf("--snapshot");
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("Informe o arquivo depois de --snapshot.");
  return path.resolve(ROOT_DIR, value);
}

function parseOutputArgument(args: string[]) {
  const index = args.indexOf("--sql-output");
  if (index === -1) return DEFAULT_APPLY_SQL_PATH;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("Informe o arquivo depois de --sql-output.");
  const outputPath = path.resolve(ROOT_DIR, value);
  const relative = path.relative(ROOT_DIR, outputPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("O SQL temporário precisa ficar dentro do workspace.");
  }
  return outputPath;
}

export function getExecutionMode(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env
): MigrationExecutionMode {
  const explicitApply = args.includes("--apply");
  const environmentDisablesDryRun = environment.DRY_RUN?.trim().toLowerCase() === "false";
  if (environmentDisablesDryRun && !explicitApply) {
    throw new Error("DRY_RUN=false não aplica dados sem a opção explícita --apply.");
  }
  return explicitApply ? "apply" : "dry-run";
}

async function loadDatabaseForDryRun(args: string[]) {
  const snapshotPath = parseSnapshotArgument(args);
  if (snapshotPath) {
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as DatabaseSnapshot;
    snapshot.visibility = "sql-snapshot";
    assertCompleteDatabaseSnapshot(snapshot);
    return {
      snapshot,
      readFinalCounts: async () => ({ ...snapshot.counts })
    };
  }

  const { client, visibility } = createReadOnlySupabaseClient();
  const snapshot = await readDatabaseSnapshot(client, visibility);
  assertCompleteDatabaseSnapshot(snapshot);
  return {
    snapshot,
    readFinalCounts: async () => ({
      products: await tableCount(client, "ecommerce_products"),
      images: await tableCount(client, "ecommerce_product_images")
    })
  };
}

async function createMigrationPlan(args: string[]) {
  const [{ products, hash }, databaseAccess] = await Promise.all([
    loadLegacyProducts(),
    loadDatabaseForDryRun(args)
  ]);

  const imageAudits = new Map<string, ImageAudit>();
  const audits = await Promise.all(
    products.map(async (product) => [product.id, await inspectLegacyProductImages(product)] as const)
  );
  for (const [legacyId, audit] of audits) imageAudits.set(legacyId, audit);

  const plan = buildMigrationPlan(products, databaseAccess.snapshot, imageAudits, hash);
  const afterCounts = await databaseAccess.readFinalCounts();
  if (
    afterCounts.products !== databaseAccess.snapshot.counts.products ||
    afterCounts.images !== databaseAccess.snapshot.counts.images
  ) {
    throw new Error("As contagens do banco mudaram durante o preflight. Execução interrompida.");
  }

  return { plan, afterCounts };
}

export async function executeDryRun(args: string[] = process.argv.slice(2)) {
  if (getExecutionMode(args) !== "dry-run") {
    throw new Error("executeDryRun não aceita --apply.");
  }
  const { plan, afterCounts } = await createMigrationPlan(args);

  const report = renderMigrationReport(plan, afterCounts);
  await writeFile(REPORT_PATH, report, "utf8");

  const blocking = plan.products.filter((product) => product.issues.length > 0).length;
  const candidates = plan.products.filter((product) => product.activationCandidate).length;
  console.log(`Dry-run concluído: ${plan.products.length} produtos analisados.`);
  console.log(`Candidatos à ativação: ${candidates}. Produtos com bloqueio: ${blocking}.`);
  console.log(`Banco inalterado: produtos=${afterCounts.products}, imagens=${afterCounts.images}.`);
  console.log(`Relatório: ${path.relative(ROOT_DIR, REPORT_PATH)}`);

  return { plan, afterCounts, reportPath: REPORT_PATH };
}

export async function executeApplyPreparation(args: string[] = process.argv.slice(2)) {
  if (getExecutionMode(args) !== "apply") {
    throw new Error("O modo de aplicação exige a opção explícita --apply.");
  }

  const { plan, afterCounts } = await createMigrationPlan(args);
  const metrics = assertPlanReadyForApply(plan);
  const sqlOutputPath = parseOutputArgument(args);
  const beforeReport = renderBeforeApplyReport(plan);
  const sql = generateApplySql(plan);

  await Promise.all([
    writeFile(BEFORE_APPLY_REPORT_PATH, beforeReport, "utf8"),
    writeFile(sqlOutputPath, sql, "utf8")
  ]);

  console.log(`Preflight de apply concluído: ${metrics.total} produtos, ${metrics.conflicts} conflitos.`);
  console.log(`Banco ainda inalterado: produtos=${afterCounts.products}, imagens=${afterCounts.images}.`);
  console.log(`Snapshot anterior: ${path.relative(ROOT_DIR, BEFORE_APPLY_REPORT_PATH)}`);
  console.log(`Transação SQL pronta: ${path.relative(ROOT_DIR, sqlOutputPath)}`);
  console.log("A transação deve ser executada uma única vez em uma sessão SQL autenticada do projeto correto.");

  return {
    plan,
    afterCounts,
    metrics,
    beforeReportPath: BEFORE_APPLY_REPORT_PATH,
    sqlOutputPath
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === invokedFile) {
  const args = process.argv.slice(2);
  const mode = getExecutionMode(args);
  const execution = mode === "apply" ? executeApplyPreparation(args) : executeDryRun(args);
  execution.catch((error) => {
    console.error(`Falha no ${mode}: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
