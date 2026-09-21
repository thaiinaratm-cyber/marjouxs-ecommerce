import { categories } from "@/data/categories";
import { getCategoryFilterHref, getProductCategoryFilter } from "@/lib/category-navigation";
import { normalizeText } from "@/lib/format";
import { isMadeToOrder } from "@/lib/product-merchandising";
import { hasIncludedEngravingAndBox, hasValidPrice } from "@/lib/product-pricing";
import {
  getRingProductSubcategorySlug,
  getRingSubcategory,
  matchesRingMaterial,
  type RingMaterialSlug
} from "@/lib/ring-filters";
import type { Product } from "@/types/product";

export const SITE_URL = "https://marjouxsjoias.com.br";
export const SITE_NAME = "Marjouxs Joalheria";
export const DEFAULT_SOCIAL_IMAGE = "/images/banner-joias-marjouxs.png";

export type BreadcrumbItem = {
  name: string;
  href: string;
};

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function appendWithinLimit(parts: string[], text: string, maximum = 160) {
  const next = [...parts, text].join(" ");
  if (next.length <= maximum) parts.push(text);
}

export function getProductSeoDescription(product: Product) {
  const normalizedName = normalizeText(product.name);
  const material = product.material.trim();
  const materialSuffix = material && !normalizedName.includes(normalizeText(material)) ? ` em ${material}` : "";
  const parts = [`${product.name}${materialSuffix} na Marjouxs Joalheria.`];

  if (product.stockStatus === "Indisponível") {
    appendWithinLimit(parts, "Consulte nossa equipe sobre disponibilidade.");
  } else if (isMadeToOrder(product)) {
    appendWithinLimit(parts, "Disponível sob encomenda.");
  } else if (product.stockStatus === "Disponível") {
    appendWithinLimit(parts, "Disponível para compra online.");
  }

  if (hasIncludedEngravingAndBox(product)) {
    appendWithinLimit(parts, "Gravação inclusa.");
  }

  if (hasValidPrice(product)) {
    appendWithinLimit(parts, "Compre com 10% OFF no Pix e em até 12x.");
  } else {
    appendWithinLimit(parts, "Consulte as condições pelo WhatsApp.");
  }

  if (parts.join(" ").length < 140) {
    appendWithinLimit(parts, "Atendimento personalizado em Arujá.");
  }

  return parts.join(" ");
}

export function getProductAvailability(product: Product) {
  if (product.stockStatus === "Indisponível") return "https://schema.org/OutOfStock";
  if (isMadeToOrder(product)) return undefined;
  if (product.stockStatus === "Disponível") return "https://schema.org/InStock";
  return undefined;
}

export function getProductSchema(product: Product) {
  const url = absoluteUrl(`/produtos/${product.slug}`);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    description: getProductSeoDescription(product),
    image: product.images.map(absoluteUrl),
    brand: {
      "@type": "Brand",
      name: "Marjouxs"
    }
  };

  if (hasValidPrice(product) && product.price) {
    const availability = getProductAvailability(product);
    schema.offers = {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "BRL",
      url,
      ...(availability ? { availability } : {}),
      seller: {
        "@id": `${SITE_URL}/#organization`
      }
    };
  }

  return schema;
}

function getRingMaterialSlug(product: Product): RingMaterialSlug | null {
  if (matchesRingMaterial(product, "ouro-18k")) return "ouro-18k";
  if (matchesRingMaterial(product, "prata-950")) return "prata-950";
  return null;
}

export function getProductBreadcrumbs(product: Product): BreadcrumbItem[] {
  const category = categories.find((item) => item.name === product.category);
  const items: BreadcrumbItem[] = [{ name: "Home", href: "/" }];

  if (!category) {
    return [...items, { name: product.name, href: `/produtos/${product.slug}` }];
  }

  items.push({ name: category.name, href: `/categorias/${category.slug}` });

  if (category.slug === "aneis") {
    const materialSlug = getRingMaterialSlug(product);

    if (materialSlug) {
      const materialLabel = materialSlug === "ouro-18k" ? "Ouro 18k" : "Prata 950";
      items.push({ name: materialLabel, href: `/aneis/${materialSlug}` });

      const subcategorySlug = getRingProductSubcategorySlug(product);
      const subcategory = getRingSubcategory(materialSlug, subcategorySlug);
      if (subcategory) {
        items.push({ name: subcategory.label, href: `/aneis/${materialSlug}/${subcategory.slug}` });
      }
    }
  } else {
    const filter = getProductCategoryFilter(category.slug, product);
    if (filter) {
      items.push({ name: filter.label, href: getCategoryFilterHref(category.slug, filter) });
    }
  }

  items.push({ name: product.name, href: `/produtos/${product.slug}` });
  return items;
}

export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href)
    }))
  };
}

export function getCategorySeoDescription(subtitle: string, products: Product[]) {
  const madeToOrderCount = products.filter(isMadeToOrder).length;
  const availability = madeToOrderCount === products.length && products.length > 0
    ? "Modelos sob encomenda."
    : madeToOrderCount > 0
      ? "Modelos disponíveis e sob encomenda."
      : "Conheça os modelos da Marjouxs.";
  const description = `${subtitle} ${availability} 10% OFF no Pix e até 12x.`;

  if (description.length <= 160) return description;
  return `${description.slice(0, 157).replace(/\s+\S*$/, "")}...`;
}

export const organizationWebsiteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "JewelryStore",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      image: absoluteUrl("/images/loja-marjouxs.jpg"),
      email: "marjouxsgold@gmail.com",
      telephone: "+5511915818241",
      sameAs: ["https://www.instagram.com/marjouxs/"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "Avenida João Manoel, 600, Prédio JM 600, Térreo, Loja 05",
        addressLocality: "Arujá",
        addressRegion: "SP",
        postalCode: "07400-610",
        addressCountry: "BR"
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "09:00",
          closes: "18:00"
        },
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: "Saturday",
          opens: "09:00",
          closes: "13:00"
        }
      ]
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/produtos?busca={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
};
