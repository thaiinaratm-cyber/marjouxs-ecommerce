import { GOOGLE_PRODUCT_BRAND, getGoogleProductAvailability, getGoogleProductId } from "@/lib/google-product-fields";
import { hasValidPrice } from "@/lib/product-pricing";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
import type { CategoryName, Product } from "@/types/product";

const googleCategories: Partial<Record<CategoryName, string>> = {
  "Alianças": "200", "Anéis": "200", "Brincos": "194", "Correntes": "196",
  "Pulseiras": "191", "Braceletes": "191", "Pingentes": "192", "Relógios": "201"
};

export type MerchantItem = {
  id: string; title: string; description: string; link: string;
  image_link: string; additional_image_link: string[];
  availability: "in_stock"; price: string; sale_price?: string;
  condition: "new"; brand: string; google_product_category: string;
  product_type: string; identifier_exists: "false"; material?: string;
};

function xmlText(value: string) {
  return Array.from(value).filter((character) => {
    const code = character.codePointAt(0)!;
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff)
      || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);
  }).join("");
}

export function escapeMerchantXml(value: string) {
  return xmlText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function plainText(value: string) {
  return xmlText(value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    && Number.isSafeInteger(Math.round(value * 100)) && Number(value.toFixed(2)) === value;
}

function imageUrl(image: string, availableImages: ReadonlySet<string>) {
  if (!image.startsWith("/produtos/") || !availableImages.has(image)
    || image.includes("\\") || image.includes("..") || /[?#]/.test(image)
    || /placeholder|imagem-em-breve/i.test(image)) return undefined;
  return new URL(image, SITE_URL).href;
}

export function getMerchantItems(products: Product[], availableImages: ReadonlySet<string>) {
  const items: MerchantItem[] = [];
  const ids = new Set<string>();
  const links = new Set<string>();
  for (const product of products) {
    const category = googleCategories[product.category];
    if (!category || getGoogleProductAvailability(product) !== "in_stock"
      || !hasValidPrice(product) || !validAmount(product.price)
      || !product.id.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) continue;
    const primaryImage = imageUrl(product.images[0] ?? "", availableImages);
    const title = plainText(product.name).slice(0, 150);
    const description = plainText(product.description).slice(0, 5000);
    if (!primaryImage || !title || !description) continue;
    const id = getGoogleProductId(product.id);
    const link = absoluteUrl(`/produtos/${product.slug}`);
    if (ids.has(id.toLowerCase()) || links.has(link)) throw new Error("Duplicate Merchant product");
    ids.add(id.toLowerCase());
    links.add(link);
    const sale = validAmount(product.oldPrice) && product.oldPrice > product.price;
    const additionalImages = product.images.slice(1).map((image) => imageUrl(image, availableImages))
      .filter((image): image is string => Boolean(image) && image !== primaryImage);
    items.push({
      id, title, description, link, image_link: primaryImage,
      additional_image_link: Array.from(new Set(additionalImages)).slice(0, 10),
      availability: "in_stock",
      price: `${(sale ? product.oldPrice! : product.price).toFixed(2)} BRL`,
      ...(sale ? { sale_price: `${product.price.toFixed(2)} BRL` } : {}),
      condition: "new", brand: GOOGLE_PRODUCT_BRAND,
      google_product_category: category,
      product_type: [product.category, product.subcategory].filter(Boolean).join(" > "),
      // Owner confirmed no eligible products have assigned GTIN/MPN identifiers.
      // Revisit when introducing products with manufacturer identifiers.
      identifier_exists: "false",
      ...(product.material.trim() ? { material: plainText(product.material) } : {})
    });
  }
  return items;
}

export function renderMerchantXml(items: MerchantItem[]) {
  const tag = (name: string, value: string) => `      <g:${name}>${escapeMerchantXml(value)}</g:${name}>`;
  const entries = items.map((item) => {
    const fields = Object.entries(item).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value]).map((entry) => tag(name, entry)));
    return `    <item>\n${fields.join("\n")}\n    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeMerchantXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>Catálogo público da Marjouxs Joias</description>
${entries.join("\n")}
  </channel>
</rss>\n`;
}
