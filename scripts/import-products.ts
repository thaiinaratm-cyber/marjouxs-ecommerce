import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const CSV_DELIMITER = ";";

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
  const imageName = path.basename(value.trim());
  return `/produtos/${imageName || "placeholder-joia.jpg"}`;
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

  const price = parsePrice(row.price);
  const slug = uniqueSlug(slugify(row.name), usedSlugs);
  const oldPrice = parseOptionalNumber(row.oldPrice ?? "");

  return {
    id: slug,
    name: row.name,
    slug,
    category: row.category,
    subcategory: row.subcategory,
    material: row.material,
    price,
    oldPrice,
    discountPercent: parseOptionalNumber(row.discountPercent ?? ""),
    cashDiscountPercent: parseOptionalNumber(row.cashDiscountPercent ?? ""),
    installmentsCount: parseOptionalNumber(row.installmentsCount ?? ""),
    priceLabel: row.priceLabel || (price === null ? "Sob orçamento" : formatCurrency(price)),
    installments: row.installments,
    description: row.description,
    images: [normalizeImagePath(row.image)],
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

async function main() {
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
