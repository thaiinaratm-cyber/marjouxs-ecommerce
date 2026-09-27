import { readFileSync } from "node:fs";
import path from "node:path";

export type CategoryBannerPage = {
  categorySlug: string;
  variantSlug?: string;
  pathname?: string;
};

type BannerAsset = { file: string; alt: string };

// Exact category, category:subcategory, or pathname keys. Keep original filenames.
// No parent banner is inherited by a subcategory without its own matching asset.
const bannerAssets: Record<string, BannerAsset> = {
  "aliancas:banhado-a-ouro": { file: "aliancas-banhado-a-ouro.png", alt: "Alianças banhadas a ouro — Marjouxs" },
  "aliancas:ouro-18k-750": { file: "aliancas-ouro18k.png", alt: "Alianças em Ouro 18k — Marjouxs" },
  "aneis:ouro-18k": { file: "aneis-ouro18k.png", alt: "Anéis em Ouro 18k — Marjouxs" },
  "aneis:prata-950": { file: "aneis-prata950.png", alt: "Anéis em Prata 950 — Marjouxs" },
  "/aneis/ouro-18k/formatura": { file: "anel-formatura-ouro18k.png", alt: "Anéis de formatura em Ouro 18k — Marjouxs" },
  "/aneis/ouro-18k/perola": { file: "anel-perola-ouro18k.png", alt: "Anéis de pérola em Ouro 18k — Marjouxs" },
  "braceletes:ouro-18k": { file: "bracelete-ouro18k.png", alt: "Braceletes em Ouro 18k — Marjouxs" },
  "braceletes:prata-950": { file: "braceletes-prata950.png", alt: "Braceletes em Prata 950 — Marjouxs" },
  "brincos:infantil": { file: "brinco-infantil-ouro18k.png", alt: "Brincos infantis em Ouro 18k — Marjouxs" },
  "brincos:ouro-18k": { file: "brincos-ouro18k.png", alt: "Brincos em Ouro 18k — Marjouxs" },
  "brincos:prata-950": { file: "brincos-prata950.png", alt: "Brincos em Prata 950 — Marjouxs" },
  "correntes:ouro-18k": { file: "correntes-ouro18k.png", alt: "Correntes em Ouro 18k — Marjouxs" },
  "correntes:prata-950": { file: "correntes-prata950.png", alt: "Correntes em Prata 950 — Marjouxs" },
  "pingentes:ouro-18k": { file: "pingentes-ouro18k.png", alt: "Pingentes em Ouro 18k — Marjouxs" },
  "pingentes:prata-950": { file: "pingentes-prata950.png", alt: "Pingentes em Prata 950 — Marjouxs" },
  "pulseiras:infantil": { file: "pulseira-infantil-ouro18k.png", alt: "Pulseiras infantis em Ouro 18k — Marjouxs" },
  "pulseiras:ouro-18k": { file: "pulseiras-ouro18k.png", alt: "Pulseiras em Ouro 18k — Marjouxs" },
  "pulseiras:prata-950": { file: "pulseiras-prata950.png", alt: "Pulseiras em Prata 950 — Marjouxs" },
  "relogios:relogios-femininos": { file: "relogios-femininos.png", alt: "Relógios femininos — Marjouxs" },
  "relogios:relogios-masculinos": { file: "relogios-masculinos.png", alt: "Relógios masculinos — Marjouxs" }
};

// The supplied silver artwork is also approved for the existing Prata 925 pages.
bannerAssets["correntes:prata-925"] = bannerAssets["correntes:prata-950"];
bannerAssets["pulseiras:prata-925"] = bannerAssets["pulseiras:prata-950"];

// Server-side only: check the actual public file and read its intrinsic PNG size.
// Missing/unreadable files retain the existing textual presentation.
export function getCategoryBannerImage({ categorySlug, variantSlug, pathname }: CategoryBannerPage) {
  const category = categorySlug.trim().toLowerCase();
  const variant = variantSlug?.trim().toLowerCase();
  const route = pathname?.replace(/\/$/, "");
  const asset = (route ? bannerAssets[route] : undefined)
    ?? bannerAssets[variant ? `${category}:${variant}` : category];

  if (!asset) return undefined;

  try {
    const bytes = readFileSync(path.join(process.cwd(), "public", "banners-categorias", asset.file));
    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return undefined;
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (!width || !height) return undefined;

    return { src: `/banners-categorias/${asset.file}`, alt: asset.alt, width, height };
  } catch {
    return undefined;
  }
}
