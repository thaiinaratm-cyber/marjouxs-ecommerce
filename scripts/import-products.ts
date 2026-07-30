import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

type CsvRow = Record<string, string>;

type ImportedProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string;
  material: string;
  price: number | null;
  oldPrice: number | null;
  discountPercent: number | null;
  cashDiscountPercent: number | null;
  installmentsCount: number | null;
  priceLabel: string;
  installments: string;
  description: string;
  images: string[];
  featured: boolean;
  isCustomOrder: boolean;
  allowWhatsappQuote: boolean;
  stockStatus: string;
};

const REQUIRED_COLUMNS = [
  "name",
  "category",
  "subcategory",
  "material",
  "price",
  "oldPrice",
  "discountPercent",
  "cashDiscountPercent",
  "installmentsCount",
  "priceLabel",
  "installments",
  "description",
  "image",
  "featured",
  "isCustomOrder",
  "allowWhatsappQuote",
  "stockStatus"
];

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_PATH = path.join(ROOT_DIR, "data", "import", "produtos.csv");
const OUTPUT_PATH = path.join(ROOT_DIR, "data", "products.ts");
const GENERATE_PRODUCTS_SCRIPT = path.join(ROOT_DIR, "scripts", "gerar-produtos.ts");
const IMPORT_DIR = path.join(ROOT_DIR, "public", "produtos", "importar");
const CSV_DELIMITER = ";";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const PRODUCT_IMAGE_PLACEHOLDER = "/produtos/placeholder-joia.svg";
const CURRENT_MASCULINE_RING_BATCH_COUNT = 87;
const CURRENT_MASCULINE_RING_BATCH_HASH = "0c84f6e2d7d3360e2db761db53c355795b66e1adc39cd9d9a2fbda6178be2780";
const GRADUATION_RING_DESCRIPTION = `Anel de formatura em Ouro 18k, personalizado de acordo com a área de formação do cliente.

A cor da pedra central será definida conforme o curso escolhido, e o símbolo aplicado nas laterais do anel também será personalizado de acordo com a profissão ou área de formação.

A imagem representa o modelo e o acabamento do anel. A cor da pedra e os símbolos laterais podem variar conforme a personalização solicitada.

Após a compra, nossa equipe entrará em contato para confirmar:

• Curso ou área de formação
• Cor da pedra
• Símbolo das laterais
• Numeração do aro

Produto personalizado e confeccionado sob encomenda.`;

function detectDelimiter(headerLine: string) {
  const chars = headerLine.split("");
  const semicolonCount = chars.filter((char) => char === ";").length;
  const commaCount = chars.filter((char) => char === ",").length;
  return semicolonCount >= commaCount ? CSV_DELIMITER : ",";
}

function parseCsv(content: string): CsvRow[] {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(normalizedContent.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < normalizedContent.length; index += 1) {
    const char = normalizedContent[index];
    const next = normalizedContent[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field.trim());
      field = "";
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  if (!headers) {
    throw new Error(`CSV vazio em ${INPUT_PATH}`);
  }

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Colunas obrigatorias ausentes: ${missingColumns.join(", ")}. Use CSV separado por ponto e virgula (;).`);
  }

  return dataRows.map((dataRow) =>
    headers.reduce<CsvRow>((accumulator, header, index) => {
      accumulator[header] = dataRow[index] ?? "";
      return accumulator;
    }, {})
  );
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(baseSlug: string, usedSlugs: Set<string>) {
  let slug = baseSlug || "produto";
  let suffix = 2;

  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(slug);
  return slug;
}

function parseBoolean(value: string) {
  const normalized = normalizeText(value);
  return ["sim", "s", "true", "1", "yes"].includes(normalized);
}

function parsePrice(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const price = Number(normalized.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(price)) {
    throw new Error(`Preco invalido: ${value}`);
  }

  return price;
}

function getImageTokens(value: string) {
  let baseName = path.basename(value.trim());

  while (IMAGE_EXTENSIONS.has(path.extname(baseName).toLowerCase())) {
    baseName = path.basename(baseName, path.extname(baseName));
  }

  return baseName
    .split(/[-_\s]+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);
}

function detectPriceFromImage(value: string) {
  const tokens = getImageTokens(value);

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (/^\d{2,6}$/.test(token) && !["925", "950", "750", "18"].includes(token)) {
      return Number(token);
    }
  }

  return null;
}

function defaultInstallmentsCount(category: string, material: string, price: number | null) {
  if (price === null) return null;
  if ((category === "Alianças" || category === "Anéis") && material === "Ouro 18k") return 12;
  if (category === "Alianças" && (material.includes("Prata") || material === "Banhado a ouro" || material === "Moeda")) return 6;
  if (category === "Anéis" && material.includes("Prata")) return 6;
  return null;
}

function defaultInstallments(category: string, material: string, price: number | null) {
  if (price === null) return "Consulte condições de parcelamento";
  if ((category === "Alianças" || category === "Anéis") && material === "Ouro 18k") return "Até 12x sem juros";
  if (category === "Alianças" && (material.includes("Prata") || material === "Banhado a ouro" || material === "Moeda")) return "Até 6x sem juros";
  if (category === "Anéis" && material.includes("Prata")) return "Até 6x sem juros";
  return "Até 6x sem juros";
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const number = Number(normalized.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(number)) {
    throw new Error(`Numero invalido: ${value}`);
  }

  return number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function normalizeImagePath(value: string) {
  const normalizedPath = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/?produtos\//, "")
    .replace(/^importar\//, "")
    .replace(/^\/+/, "");

  return `/produtos/${normalizedPath || "placeholder-joia.jpg"}`;
}

function resolveExistingProductImage(imagePath: string) {
  const absoluteImagePath = path.join(ROOT_DIR, "public", imagePath.replace(/^\/+/, ""));

  if (existsSync(absoluteImagePath)) {
    return imagePath;
  }

  console.log(`Imagem ausente no catálogo: ${imagePath}. Usando ${PRODUCT_IMAGE_PLACEHOLDER}.`);
  return PRODUCT_IMAGE_PLACEHOLDER;
}

function isGraduationRingImage(value: string) {
  const imageName = path.basename(value.trim(), path.extname(value.trim()));
  return normalizeText(imageName).startsWith("anel-formatura-");
}

function toImportPath(value: string) {
  return value.replace(/\\/g, "/");
}

async function listImportBatchImageFiles(directory: string, baseDirectory = directory): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listImportBatchImageFiles(absolutePath, baseDirectory)));
      continue;
    }

    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(toImportPath(path.relative(baseDirectory, absolutePath)));
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function getCurrentMasculineRingBatchFiles() {
  const files = await listImportBatchImageFiles(IMPORT_DIR);
  const hash = createHash("sha256").update(files.join("\n")).digest("hex");

  if (files.length === CURRENT_MASCULINE_RING_BATCH_COUNT && hash === CURRENT_MASCULINE_RING_BATCH_HASH) {
    return files;
  }

  return [];
}

function normalizeRingSubcategory(row: CsvRow) {
  if (row.category !== "Anéis") {
    return row.subcategory;
  }

  const searchable = normalizeText([row.name, row.subcategory, row.description, row.image].join(" "));

  if (searchable.includes("formatura")) {
    return "Formatura";
  }

  if (searchable.includes("perola")) {
    return "Pérola";
  }

  if (searchable.includes("masculino")) {
    return "Masculino";
  }

  return "Feminino";
}

function normalizeStockStatus(value: string, price: number | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return price === null ? "Sob encomenda" : "Disponível";
  }

  if (normalized === "disponivel") {
    return "Disponível";
  }

  if (normalized === "sob encomenda") {
    return "Sob encomenda";
  }

  if (normalized === "indisponivel") {
    return "Indisponível";
  }

  if (normalized === "servico") {
    return "Serviço";
  }

  throw new Error(`stockStatus invalido: ${value}`);
}

function rowToProduct(row: CsvRow, usedSlugs: Set<string>): ImportedProduct {
  if (!row.name) {
    throw new Error("Produto sem nome encontrado no CSV.");
  }

  const price = parsePrice(row.price) ?? detectPriceFromImage(row.image);
  const slug = uniqueSlug(slugify(row.name), usedSlugs);
  const oldPrice = parseOptionalNumber(row.oldPrice ?? "");
  const imagePath = resolveExistingProductImage(normalizeImagePath(row.image));
  const installmentsCount = parseOptionalNumber(row.installmentsCount ?? "") ?? defaultInstallmentsCount(row.category, row.material, price);
  const normalizedPriceLabel = normalizeText(row.priceLabel ?? "");
  const priceLabel =
    price !== null && (!row.priceLabel || normalizedPriceLabel === "sob orcamento")
      ? formatCurrency(price)
      : row.priceLabel || (price === null ? "Sob orçamento" : formatCurrency(price));
  const normalizedInstallments = normalizeText(row.installments ?? "");
  const installments =
    price !== null && (!row.installments || normalizedInstallments.startsWith("consulte"))
      ? defaultInstallments(row.category, row.material, price)
      : row.installments || defaultInstallments(row.category, row.material, price);

  return {
    id: slug,
    name: row.name,
    slug,
    category: row.category,
    subcategory: normalizeRingSubcategory(row),
    material: row.material,
    price,
    oldPrice,
    discountPercent: parseOptionalNumber(row.discountPercent ?? ""),
    cashDiscountPercent: parseOptionalNumber(row.cashDiscountPercent ?? ""),
    installmentsCount,
    priceLabel,
    installments,
    description: isGraduationRingImage(row.image) ? GRADUATION_RING_DESCRIPTION : row.description,
    images: [imagePath],
    featured: parseBoolean(row.featured),
    isCustomOrder: parseBoolean(row.isCustomOrder),
    allowWhatsappQuote: parseBoolean(row.allowWhatsappQuote),
    stockStatus: normalizeStockStatus(row.stockStatus, price)
  };
}

function buildProductsFile(products: ImportedProduct[]) {
  return `import type { Product } from "@/types/product";

export const products: Product[] = ${JSON.stringify(products, null, 2)};
`;
}

async function runGenerateProductsFromImages() {
  const masculineRingBatchFiles = await getCurrentMasculineRingBatchFiles();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [GENERATE_PRODUCTS_SCRIPT], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        SKIP_IMPORT_PRODUCTS: "1",
        MARJOUXS_MASCULINE_RING_BATCH_FILES: masculineRingBatchFiles.join("|")
      },
      stdio: "inherit"
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`geração de produtos por imagem falhou com codigo ${code}`));
    });
  });
}

async function main() {
  await runGenerateProductsFromImages();

  const csv = await readFile(INPUT_PATH, "utf8");
  const rows = parseCsv(csv);
  const usedSlugs = new Set<string>();
  const products = rows.map((row) => rowToProduct(row, usedSlugs));

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, buildProductsFile(products), "utf8");

  console.log(`Importados ${products.length} produtos para data/products.ts`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
