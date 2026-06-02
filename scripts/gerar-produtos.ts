import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

type ProductRow = {
  name: string;
  category: string;
  subcategory: string;
  material: string;
  price: string;
  oldPrice: string;
  discountPercent: string;
  cashDiscountPercent: string;
  installmentsCount: string;
  priceLabel: string;
  installments: string;
  description: string;
  image: string;
  featured: string;
  isCustomOrder: string;
  allowWhatsappQuote: string;
  stockStatus: string;
};

const COLUMNS: Array<keyof ProductRow> = [
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
const IMPORT_DIR = path.join(ROOT_DIR, "public", "produtos", "importar");
const FINAL_IMAGE_DIR = path.join(ROOT_DIR, "public", "produtos");
const CSV_PATH = path.join(ROOT_DIR, "data", "import", "produtos.csv");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const ignoredWords = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "com",
  "para",
  "por",
  "a",
  "o",
  "e"
]);

const accentWords: Record<string, string> = {
  alianca: "Aliança",
  aliancas: "Alianças",
  aneis: "Anéis",
  anel: "Anel",
  brinco: "Brinco",
  brincos: "Brincos",
  corrente: "Corrente",
  correntes: "Correntes",
  pulseira: "Pulseira",
  pulseiras: "Pulseiras",
  pingente: "Pingente",
  pingentes: "Pingentes",
  relogio: "Relógio",
  relogios: "Relógios",
  servico: "Serviço",
  servicos: "Serviços",
  zirconia: "Zircônia",
  perola: "Pérola",
  classica: "Clássica",
  classico: "Clássico",
  gravacao: "Gravação",
  coracao: "Coração",
  solitario: "Solitário",
  masculino: "Masculino",
  feminina: "Feminina",
  feminino: "Feminino",
  infantil: "Infantil",
  religiosos: "Religiosos",
  religioso: "Religioso",
  ouro18k: "Ouro 18k",
  "18k": "18k",
  "925": "925",
  "950": "950"
};

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

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const normalized = normalizeText(word);
      if (ignoredWords.has(normalized)) {
        return normalized;
      }
      if (/^\d+k$/i.test(word) || /^\d+$/.test(word)) {
        return word;
      }
      if (accentWords[normalized]) {
        return accentWords[normalized];
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseCsv(content: string): ProductRow[] {
  const text = content.replace(/^\uFEFF/, "");
  const delimiter = (text.split(/\r?\n/, 1)[0]?.match(/;/g)?.length ?? 0) > 0 ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
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
    return [];
  }

  return dataRows.map((dataRow) =>
    COLUMNS.reduce<ProductRow>((accumulator, column) => {
      const index = headers.indexOf(column);
      accumulator[column] = index >= 0 ? dataRow[index] ?? "" : "";
      return accumulator;
    }, {} as ProductRow)
  );
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function serializeCsv(rows: ProductRow[]) {
  const lines = [
    COLUMNS.map((column) => escapeCsv(column)).join(";"),
    ...rows.map((row) => COLUMNS.map((column) => escapeCsv(row[column] ?? "")).join(";"))
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function getTokens(fileName: string) {
  return path
    .basename(fileName, path.extname(fileName))
    .split(/[-_\s]+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);
}

function detectPrice(tokens: string[]) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (/^\d{2,6}$/.test(token) && !["925", "950", "750", "18"].includes(token)) {
      return Number(token);
    }
  }
  return null;
}

function detectPricing(tokens: string[]) {
  const priceTokens = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => /^\d{2,6}$/.test(token) && !["925", "950", "750", "18"].includes(token));
  const price = detectPrice(tokens);

  if (price === null || priceTokens.length < 2) {
    return { price, oldPrice: null };
  }

  const last = priceTokens[priceTokens.length - 1];
  const previous = priceTokens[priceTokens.length - 2];
  const previousValue = Number(previous.token);
  const lastValue = Number(last.token);
  const oldPrice = previous.index === last.index - 1 && previousValue > lastValue ? previousValue : null;

  return { price: lastValue, oldPrice };
}

function hasOuro18k(tokens: string[]) {
  return tokens.includes("ouro18k") || (tokens.includes("ouro") && tokens.includes("18k"));
}

function hasAlliance(tokens: string[]) {
  return tokens.some((token) => token.startsWith("alianca"));
}

function hasBanhadoOuro(tokens: string[]) {
  const joined = tokens.join("-");
  return (
    joined.includes("banhado-ouro") ||
    joined.includes("banhadoouro") ||
    joined.includes("banho-de-ouro") ||
    joined.includes("folheado-ouro")
  );
}

function isAllianceSolitaireCombo(tokens: string[]) {
  const joined = tokens.join("-");
  const hasComboTerm =
    tokens.includes("combo") ||
    tokens.includes("kit") ||
    tokens.includes("pacote") ||
    tokens.includes("solitario") ||
    joined.includes("anel-solitario");

  return hasAlliance(tokens) && hasComboTerm;
}

function isGraduationRing(tokens: string[]) {
  const joined = tokens.join("-");
  return (
    tokens.includes("formatura") ||
    tokens.includes("formando") ||
    tokens.includes("formanda") ||
    tokens.includes("curso") ||
    joined.includes("pedra-formatura")
  );
}

function detectCategory(tokens: string[]) {
  if (hasAlliance(tokens)) return "Alianças";
  if (tokens.some((token) => token.startsWith("anel") || token === "solitario")) return "Anéis";
  if (tokens.some((token) => token.startsWith("brinco") || token === "argola")) return "Brincos";
  if (tokens.some((token) => token.startsWith("corrente"))) return "Correntes";
  if (tokens.some((token) => token.startsWith("pulseira"))) return "Pulseiras";
  if (tokens.some((token) => token.startsWith("pingente"))) return "Pingentes";
  if (tokens.some((token) => token.startsWith("relogio"))) return "Relógios";
  if (tokens.some((token) => ["servico", "banho", "polimento", "gravacao", "conserto", "ajuste", "bateria"].includes(token))) {
    return "Serviços";
  }
  return "Anéis";
}

function detectMaterial(tokens: string[]) {
  if (hasBanhadoOuro(tokens)) return "Banhado a ouro";
  if (hasOuro18k(tokens) || (tokens.includes("ouro") && tokens.includes("750"))) return "Ouro 18k";
  if (tokens.includes("ouro")) return "Ouro";
  if (tokens.includes("prata") && tokens.includes("950")) return "Prata 950";
  if (tokens.includes("prata") && tokens.includes("925")) return "Prata 925";
  if (tokens.includes("prata")) return "Prata";
  if (tokens.includes("moeda")) return "Moeda";
  if (tokens.includes("zirconia")) return "Zircônia";
  if (tokens.includes("perola")) return "Pérola";
  if (tokens.includes("semijoia")) return "Semijoia";
  return "A definir";
}

function detectSubcategory(category: string, tokens: string[], material: string) {
  if (category === "Alianças") {
    if (material === "Ouro 18k") return "Alianças Ouro 18k";
    if (material === "Banhado a ouro") return "Alianças Banhado a Ouro";
    if (material === "Moeda") return "Alianças Moeda";
    if (material.includes("Prata")) return "Alianças Prata";
    if (tokens.includes("sob") || tokens.includes("encomenda")) return "Alianças sob encomenda";
  }
  if (category === "Anéis") {
    if (isGraduationRing(tokens)) return "Anéis de Formatura";
    if (tokens.includes("solitario")) return "Solitários";
    if (material.includes("Ouro")) return "Anéis em Ouro";
    if (material.includes("Prata")) return "Anéis em Prata";
    return "Anéis femininos";
  }
  if (category === "Brincos") {
    if (tokens.includes("argola")) return "Argolas";
    if (tokens.includes("infantil")) return "Brincos infantis";
    if (tokens.includes("ponto") && tokens.includes("luz")) return "Ponto de luz";
    if (material.includes("Ouro")) return "Brincos em Ouro";
    if (material.includes("Prata")) return "Brincos em Prata";
  }
  if (category === "Correntes") return material.includes("Ouro") ? "Correntes em Ouro" : "Correntes em Prata";
  if (category === "Pulseiras") return tokens.includes("chapinha") ? "Pulseiras chapinha" : "Pulseiras em Ouro";
  if (category === "Pingentes") return tokens.includes("religioso") ? "Religiosos" : "Personalizados";
  if (category === "Serviços") return titleCase(tokens.filter((token) => !/^\d+$/.test(token)).join(" "));
  return category;
}

function buildName(tokens: string[], price: number | null, oldPrice: number | null = null) {
  if (isAllianceSolitaireCombo(tokens)) {
    const material = detectMaterial(tokens);
    const materialName = material === "Banhado a ouro" ? "Banhado a Ouro" : material;
    const suffix = materialName === "A definir" ? "" : ` ${materialName}`;

    return `Combo Alianças${suffix} + Anel Solitário`;
  }

  const cleanTokens = tokens.filter((token, index) => {
    const isCurrentPrice = price !== null && token === String(price) && index === tokens.length - 1;
    const isOldPrice = oldPrice !== null && token === String(oldPrice) && index === tokens.length - 2;

    return !isCurrentPrice && !isOldPrice;
  });
  const displayTokens = cleanTokens.reduce<string[]>((accumulator, token, index) => {
    const next = cleanTokens[index + 1];
    if (token === "banho" && next === "de") {
      return accumulator;
    }
    if (token === "de" && cleanTokens[index - 1] === "banho" && next === "ouro") {
      accumulator.push("banhado", "a");
      return accumulator;
    }
    if (token === "banhado" && next === "ouro") {
      accumulator.push("banhado", "a");
      return accumulator;
    }
    accumulator.push(token);
    return accumulator;
  }, []);
  return titleCase(displayTokens.join(" "));
}

function formatPriceForCsv(price: number | null) {
  return price === null ? "" : String(price).replace(".", ",");
}

function buildInstallmentsCount(category: string, material: string, price: number | null) {
  if (price === null) return "";
  if ((category === "Alianças" || category === "Anéis") && material === "Ouro 18k") return "12";
  if (category === "Alianças" && (material.includes("Prata") || material === "Banhado a ouro" || material === "Moeda")) return "6";
  if (category === "Anéis" && material.includes("Prata")) return "6";
  return "";
}

function formatPriceLabel(price: number | null) {
  if (price === null) return "Sob orçamento";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

function keywordPhrase(tokens: string[]) {
  const cleanTokens = tokens.filter((token) => !/^\d+$/.test(token));
  return cleanTokens.join(" ");
}

function generateDescription(category: string, material: string, tokens: string[], price: number | null) {
  const phrase = keywordPhrase(tokens);
  const has = (token: string) => tokens.includes(token);

  if (category === "Alianças") {
    if (isAllianceSolitaireCombo(tokens)) {
      if (material === "Ouro 18k") {
        return "Combo completo com par de alianças em ouro 18k e anel solitário, feito sob encomenda para momentos especiais. Confeccionamos diversos modelos em até 3 dias. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 12x sem juros pelo WhatsApp.";
      }
      if (material === "Banhado a ouro") {
        return "Combo completo com par de alianças banhadas a ouro e anel solitário, ideal para presentear em momentos especiais. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 6x sem juros pelo WhatsApp.";
      }
      if (material === "Prata 950") {
        return "Combo completo com par de alianças em prata 950 e anel solitário, ideal para pedidos de namoro e momentos especiais. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 6x sem juros pelo WhatsApp.";
      }
      if (material.includes("Prata")) {
        return `Combo completo com par de alianças em ${material.toLowerCase()} e anel solitário, ideal para pedidos de namoro e momentos especiais. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 6x sem juros pelo WhatsApp.`;
      }
    }

    if (material === "Ouro 18k") {
      return "Aliança em ouro 18k/750 com acabamento elegante, feita sob encomenda para momentos especiais. Confeccionamos diversos modelos em até 3 dias. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 12x sem juros pelo WhatsApp.";
    }
    if (material.includes("Prata")) {
      return "Aliança em prata 950 com visual delicado e ótimo acabamento, ideal para simbolizar momentos especiais. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 6x sem juros pelo WhatsApp.";
    }
    if (material === "Banhado a ouro") {
      return "Aliança banhada a ouro com acabamento sofisticado e excelente apresentação. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 6x sem juros pelo WhatsApp.";
    }
    if (material === "Moeda") {
      return "Aliança em moeda com visual marcante e ótimo acabamento. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e condições pelo WhatsApp.";
    }
    return "Aliança com acabamento elegante, feita sob encomenda para momentos especiais. Confeccionamos diversos modelos em até 3 dias. Consulte numeração, gravação, prazo e condições pelo WhatsApp.";
  }

  if (category === "Anéis") {
    if (isGraduationRing(tokens)) {
      return "Anel de formatura com acabamento elegante, ideal para celebrar uma conquista especial. Consulte aro, pedra, disponibilidade e condições pelo WhatsApp.";
    }
    const detail = has("perola") ? " com detalhe em pérola" : has("solitario") ? " solitário" : "";
    return `Anel em ${material}${detail}, ideal para compor produções elegantes e presentear em momentos especiais. Peça com visual sofisticado inspirada em ${phrase}. Consulte disponibilidade, aro e condições pelo WhatsApp.`;
  }

  if (category === "Brincos") {
    const detail = has("ponto") && has("luz") ? " ponto de luz" : has("argola") ? " argola" : "";
    return `Brinco${detail} em ${material}, delicado e versátil para o dia a dia ou ocasiões especiais. Peça com brilho discreto e acabamento elegante. Consulte disponibilidade e condições pelo WhatsApp.`;
  }

  if (category === "Correntes") {
    return `Corrente em ${material}, com estilo elegante para compor diferentes produções. Peça de presença versátil e acabamento cuidadoso. Consulte disponibilidade e condições pelo WhatsApp.`;
  }

  if (category === "Pulseiras") {
    return `Pulseira em ${material}, com acabamento delicado e visual elegante para uso próprio ou presente. Consulte disponibilidade, medidas e condições pelo WhatsApp.`;
  }

  if (category === "Pingentes") {
    return `Pingente em ${material}, ideal para compor com correntes e criar uma peça com significado. Consulte disponibilidade e condições pelo WhatsApp.`;
  }

  if (category === "Serviços") {
    return `Serviço de ${phrase}, realizado mediante avaliação da peça. Consulte orçamento, prazo e condições pelo WhatsApp.`;
  }

  return `${titleCase(phrase)} em ${material}, com apresentação elegante para diferentes ocasiões. Consulte disponibilidade, medidas e condições pelo WhatsApp.`;
}

function isCustomOrder(category: string, subcategory: string, price: number | null) {
  if (category === "Serviços" && price === null) return "sim";
  if (category === "Alianças" && (subcategory === "Alianças Ouro 18k" || price === null || normalizeText(subcategory).includes("sob encomenda"))) return "sim";
  return "não";
}

function buildInstallments(category: string, material: string, price: number | null) {
  if (price === null) return "Consulte condições de parcelamento";
  if (category === "Alianças" && material === "Ouro 18k") return "Até 12x sem juros";
  if (category === "Alianças" && (material.includes("Prata") || material === "Banhado a ouro")) return "Até 6x sem juros";
  if (category === "Anéis" && material === "Ouro 18k") return "Até 12x sem juros";
  if (category === "Anéis" && material.includes("Prata")) return "Até 6x sem juros";
  return "Até 6x sem juros";
}

function buildStockStatus(category: string, material: string, price: number | null) {
  if (price === null) return "sob encomenda";
  if (category === "Alianças" && material === "Ouro 18k") return "sob encomenda";
  return "disponível";
}

function buildRowFromImage(fileName: string): ProductRow {
  const tokens = getTokens(fileName);
  const { price, oldPrice } = detectPricing(tokens);
  const category = detectCategory(tokens);
  const material = detectMaterial(tokens);
  const subcategory = detectSubcategory(category, tokens, material);

  return {
    name: buildName(tokens, price, oldPrice),
    category,
    subcategory,
    material,
    price: formatPriceForCsv(price),
    oldPrice: formatPriceForCsv(oldPrice),
    discountPercent: "",
    cashDiscountPercent: "",
    installmentsCount: buildInstallmentsCount(category, material, price),
    priceLabel: formatPriceLabel(price),
    installments: buildInstallments(category, material, price),
    description: generateDescription(category, material, tokens, price),
    image: fileName,
    featured: "não",
    isCustomOrder: isCustomOrder(category, subcategory, price),
    allowWhatsappQuote: "sim",
    stockStatus: buildStockStatus(category, material, price)
  };
}

async function runImportProducts() {
  await new Promise<void>((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm", "run", "import-products"] : ["run", "import-products"];
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: "inherit"
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run import-products falhou com codigo ${code}`));
    });
  });
}

async function main() {
  await mkdir(IMPORT_DIR, { recursive: true });
  await mkdir(path.dirname(CSV_PATH), { recursive: true });
  await mkdir(FINAL_IMAGE_DIR, { recursive: true });

  const currentCsv = existsSync(CSV_PATH) ? await readFile(CSV_PATH, "utf8") : "";
  const rows = parseCsv(currentCsv);
  const existingImages = new Set(rows.map((row) => normalizeText(path.basename(row.image))));

  const files = (await readdir(IMPORT_DIR)).filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const newRows: ProductRow[] = [];

  for (const file of files) {
    const row = buildRowFromImage(file);
    const imageKey = normalizeText(path.basename(row.image));

    if (existingImages.has(imageKey)) {
      console.log(`Ignorado duplicado: ${file}`);
      continue;
    }

    const from = path.join(IMPORT_DIR, file);
    const to = path.join(FINAL_IMAGE_DIR, file);

    if (existsSync(to)) {
      console.log(`Imagem ja existe em public/produtos, produto ignorado: ${file}`);
      continue;
    }

    await rename(from, to);
    newRows.push(row);
    existingImages.add(imageKey);
  }

  await writeFile(CSV_PATH, serializeCsv([...rows, ...newRows]), "utf8");
  console.log(`Produtos novos gerados: ${newRows.length}`);

  await runImportProducts();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
