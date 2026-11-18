import { normalizeText } from "@/lib/format";
import { hasValidPrice } from "@/lib/product-pricing";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";
import { getStoneOptions } from "@/lib/stone-customization";
import type { Product } from "@/types/product";

export function isMadeToOrder(product: Product) {
  if (product.stockStatus === "Indisponível" || product.stockStatus === "Serviço") return false;

  return product.isCustomOrder || product.stockStatus === "Sob encomenda" ||
    normalizeText(product.description).includes("sob encomenda");
}

export function isPhysicalProduct(product: Product) {
  return product.category !== "Serviços" && product.stockStatus !== "Serviço" && product.stockStatus !== "Indisponível";
}

export function getProductionDeadline(product: Product) {
  return isPhysicalProduct(product) && product.category !== "Relógios" && hasValidPrice(product)
    ? JEWELRY_PRODUCTION_DEADLINE
    : null;
}

export function getProductFaqTopics(product: Product) {
  const topics: Array<"sizing" | "engraving" | "stone" | "policies"> = [];
  if (!isPhysicalProduct(product) || (!hasValidPrice(product) && !product.allowWhatsappQuote)) return topics;

  if (product.category === "Alianças" || product.category === "Anéis") topics.push("sizing");
  if (hasValidPrice(product)) {
    if (product.category === "Alianças" && product.engravingAvailable === true) topics.push("engraving");
    if (getStoneOptions(product).length) topics.push("stone");
  }
  topics.push("policies");
  return topics;
}
