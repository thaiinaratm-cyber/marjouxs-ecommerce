import { normalizeText } from "@/lib/format";
import { hasIncludedEngravingAndBox, hasValidPrice } from "@/lib/product-pricing";
import type { Product } from "@/types/product";

export type ProductCommercialDetailKind =
  | "material"
  | "availability"
  | "sizing"
  | "production"
  | "pair"
  | "included"
  | "warranty";

export type ProductCommercialDetail = {
  kind: ProductCommercialDetailKind;
  label: string;
  value: string;
};

export type ProductTrustBenefitKind =
  | "secure"
  | "custom"
  | "installments"
  | "pix"
  | "store"
  | "aftercare";

export type ProductTrustBenefit = {
  kind: ProductTrustBenefitKind;
  label: string;
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isMadeToOrder(product: Product) {
  if (product.stockStatus === "Indisponível" || product.stockStatus === "Serviço") {
    return false;
  }

  return (
    product.isCustomOrder ||
    product.stockStatus === "Sob encomenda" ||
    normalizeText(product.description).includes("sob encomenda")
  );
}

export function getProductionDeadline(product: Product) {
  const match = product.description.match(/\baté\s+\d+\s+dias?(?:\s+úteis)?\b/i);
  return match ? capitalize(match[0]) : null;
}

function getWarrantyDescription(product: Product) {
  const sentence = product.description
    .split(/(?<=[.!?])\s+|\n+/)
    .find((item) => normalizeText(item).includes("garantia"));

  return sentence?.trim().replace(/[.!?]+$/, "") ?? null;
}

export function getProductCommercialDetails(product: Product) {
  const alliance = product.category === "Alianças";
  const productionDeadline = getProductionDeadline(product);
  const warrantyDescription = getWarrantyDescription(product);
  const details: Array<ProductCommercialDetail | null> = [
    product.material
      ? { kind: "material", label: "Material", value: product.material }
      : null,
    product.stockStatus
      ? {
          kind: "availability",
          label: "Disponibilidade",
          value:
            product.stockStatus === "Indisponível"
              ? product.stockStatus
              : isMadeToOrder(product)
                ? "Sob encomenda"
                : product.stockStatus
        }
      : null,
    alliance
      ? { kind: "sizing", label: "Numeração", value: "Escolha os dois aros abaixo" }
      : null,
    productionDeadline
      ? { kind: "production", label: "Confecção", value: productionDeadline }
      : null,
    alliance
      ? { kind: "pair", label: "Valor", value: "Referente ao par" }
      : null,
    hasIncludedEngravingAndBox(product)
      ? {
          kind: "included",
          label: "Inclusos",
          value: "Gravação dos nomes e caixinha de joia"
        }
      : null,
    warrantyDescription
      ? { kind: "warranty", label: "Garantia", value: warrantyDescription }
      : null
  ];

  return details.filter((detail): detail is ProductCommercialDetail => Boolean(detail));
}

export function getProductTrustBenefits(product: Product) {
  const benefits: Array<ProductTrustBenefit | null> = [
    { kind: "secure", label: "Pagamento seguro" },
    isMadeToOrder(product) ? { kind: "custom", label: "Produto sob encomenda" } : null,
    hasValidPrice(product) ? { kind: "installments", label: "Até 12x" } : null,
    hasValidPrice(product) ? { kind: "pix", label: "10% OFF no Pix" } : null,
    { kind: "store", label: "Loja física em Arujá" },
    { kind: "aftercare", label: "Atendimento pós-venda" }
  ];

  return benefits
    .filter((benefit): benefit is ProductTrustBenefit => Boolean(benefit))
    .slice(0, 4);
}
