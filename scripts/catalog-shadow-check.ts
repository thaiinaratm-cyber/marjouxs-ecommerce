import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { readDatabaseCatalog } from "../lib/catalog/database-products.ts";
import { compareStaticAndDatabaseCatalog, shadowMetrics, type ManualBaseline } from "../lib/catalog/shadow-compare.ts";
import { renderShadowReport } from "../lib/catalog/shadow-report.ts";
import { inspectLegacyProductImages, loadLegacyProducts, type ImageAudit } from "./migrate-products-to-supabase.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "product-catalog-shadow-report.md");
const BASELINE = path.join(ROOT, ".tmp-product-migration-before.json");

async function readManualBaseline(): Promise<ManualBaseline | undefined> {
  try {
    await stat(BASELINE);
  } catch {
    return undefined;
  }
  const snapshot = JSON.parse(await readFile(BASELINE, "utf8")) as { products?: ManualBaseline[] };
  return snapshot.products?.find((product) => product.legacy_id === null && product.slug === "anel-feminino");
}

export async function runCatalogShadowCheck() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Configure SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente local para ler também os produtos inativos.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const [{ products }, database, baseline] = await Promise.all([
    loadLegacyProducts(),
    readDatabaseCatalog(client),
    readManualBaseline()
  ]);
  const audits = new Map<string, ImageAudit>();
  const results = await Promise.all(products.map(async (product) =>
    [product.id, await inspectLegacyProductImages(product)] as const
  ));
  for (const [id, audit] of results) audits.set(id, audit);

  const result = compareStaticAndDatabaseCatalog(products, database, audits, baseline);
  await writeFile(REPORT, renderShadowReport(result), "utf8");
  console.log(JSON.stringify(shadowMetrics(result)));
  console.log(`Relatório: ${path.relative(ROOT, REPORT)}`);
  if (shadowMetrics(result).critical_diff_count > 0) process.exitCode = 2;
  return result;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  runCatalogShadowCheck().catch((error) => {
    console.error(`Falha na leitura do catálogo: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
