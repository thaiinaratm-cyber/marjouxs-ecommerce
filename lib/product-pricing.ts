import type { Product } from "@/types/product";
import { formatCurrency, normalizeText } from "@/lib/format";

export function hasValidPrice(product: Product) {
  return typeof product.price === "number" && product.price > 0 && product.priceLabel.trim().toLowerCase() !== "sob orçamento";
}

function getDefinedInstallmentsCount(product: Product) {
  if (product.installmentsCount && product.installmentsCount > 0) {
    return product.installmentsCount;
  }

  const match = product.installments.match(/(\d+)\s*x/i);
  return match ? Number(match[1]) : null;
}

export function getMaxInstallmentsCount(product: Product) {
  const material = normalizeText(product.material);

  if (material.includes("prata")) {
    return 6;
  }

  if (material.includes("ouro 18k")) {
    return 12;
  }

  return getDefinedInstallmentsCount(product);
}

export function getInstallmentsText(product: Product) {
  if (!hasValidPrice(product) || !product.price) {
    return null;
  }

  const installmentsCount = getMaxInstallmentsCount(product);

  if (!installmentsCount) {
    return product.installments;
  }

  return `${installmentsCount}x de ${formatCurrency(product.price / installmentsCount)} sem juros`;
}

export function hasIncludedEngravingAndBox(product: Product) {
  const searchableText = normalizeText(`${product.category} ${product.subcategory} ${product.description}`);

  return (
    product.category === "Alianças" ||
    (searchableText.includes("gravacao") && (searchableText.includes("caixinha") || searchableText.includes("caixa")))
  );
}
