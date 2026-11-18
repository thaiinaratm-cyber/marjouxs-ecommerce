import { readFileSync } from "node:fs";
import path from "node:path";

export type CategoryBannerPage = {
  categorySlug: string;
  subcategorySlug?: string | string[];
  materialSlug?: string | string[];
  variantSlug?: string;
  pathname?: string;
};

type BannerAsset = { file: string; alt: string };

// Existing artwork is scoped to a selection, not to the category root.
const bannerAssets: Record<string, BannerAsset> = {
  "aliancas:banhado-a-ouro": { file: "aliancas-banhado-a-ouro.png", alt: "Alianças banhadas a ouro — Marjouxs" },
  "aliancas:moeda": { file: "alianças-moeda.png", alt: "Alianças de moeda — Marjouxs" },
  "aliancas:ouro-18k": { file: "aliancas-ouro18k.png", alt: "Alianças em Ouro 18k — Marjouxs" },
  "aliancas:prata-950": { file: "alianças-prata950.png", alt: "Alianças em Prata 950 — Marjouxs" },
  "aneis:ouro-18k": { file: "aneis-ouro18k.png", alt: "Anéis em Ouro 18k — Marjouxs" },
  "aneis:prata-950": { file: "aneis-prata950.png", alt: "Anéis em Prata 950 — Marjouxs" },
  "/aneis/ouro-18k/masculino": { file: "aneis-ouro-18k-masculinos.png", alt: "Anéis masculinos em Ouro 18k — Marjouxs" },
  "/aneis/ouro-18k/feminino": { file: "anel-ouro18k-femininos.png", alt: "Anéis femininos em Ouro 18k — Marjouxs" },
  "/aneis/ouro-18k/formatura": { file: "anel-formatura-ouro18k.png", alt: "Anéis de formatura em Ouro 18k — Marjouxs" },
  "/aneis/ouro-18k/perola": { file: "anel-perola-ouro18k.png", alt: "Anéis de pérola em Ouro 18k — Marjouxs" },
  "/aneis/prata-950/masculino": { file: "aneis-prata950-masculino.png", alt: "Anéis masculinos em Prata 950 — Marjouxs" },
  "/aneis/prata-950/feminino": { file: "aneis-prata950-feminino.png", alt: "Anéis femininos em Prata 950 — Marjouxs" },
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

const subcategoryAliases: Record<string, string> = {
  "aliancas:aliancas-banhado-a-ouro": "banhado-a-ouro",
  "brincos:brincos-infantis": "infantil",
  "pulseiras:pulseiras-infantis": "infantil"
};

const goldSubcategoryArtwork = new Set(["aneis:perola", "aneis:formatura", "brincos:infantil", "pulseiras:infantil"]);

function readSlug(value?: string | string[]) {
  const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function artworkMaterial(slug: string) {
  if (slug === "prata" || slug === "prata-925") return "prata-950";
  if (slug === "ouro-18k-750" || slug === "ouro-750") return "ouro-18k";
  return slug;
}

function findBannerAsset({
  categorySlug, subcategorySlug, materialSlug, variantSlug, pathname
}: CategoryBannerPage) {
  const category = readSlug(categorySlug);
  const variant = artworkMaterial(readSlug(variantSlug));
  if (pathname) {
    // Preserve the legacy ring routes and their exact material/subcategory pair.
    return bannerAssets[pathname.replace(/\/$/, "")] ?? bannerAssets[`${category}:${variant}`];
  }

  const selectedSubcategory = readSlug(subcategorySlug);
  const subcategory = subcategoryAliases[`${category}:${selectedSubcategory}`] ?? artworkMaterial(selectedSubcategory);
  const material = artworkMaterial(readSlug(materialSlug));
  const subcategoryKey = `${category}:${subcategory}`;
  const isGoldArtwork = goldSubcategoryArtwork.has(subcategoryKey);
  const materialContradictsArtwork = isGoldArtwork && material && material !== "ouro-18k";

  return (category === "aneis" && subcategory && material
    ? bannerAssets[`/aneis/${material}/${subcategory}`]
    : undefined)
    ?? (materialContradictsArtwork
      ? undefined
      : bannerAssets[subcategoryKey]
        ?? (category === "aneis" && isGoldArtwork ? bannerAssets[`/aneis/ouro-18k/${subcategory}`] : undefined))
    ?? bannerAssets[`${category}:${material}`]
    ?? bannerAssets[`${category}:${variant}`];
}

// Server-side only: check the actual public file and read its intrinsic PNG size.
// Missing/unreadable files retain the existing textual presentation.
export function getCategoryBannerImage(page: CategoryBannerPage) {
  const asset = findBannerAsset(page);
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
