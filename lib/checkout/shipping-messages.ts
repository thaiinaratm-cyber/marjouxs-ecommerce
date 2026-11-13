import { POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";

export const SHIPPING_UNAVAILABLE_MESSAGE = "Não foi possível calcular o frete agora. Tente novamente em instantes.";
export const SHIPPING_NO_COVERAGE_MESSAGE = "Não encontramos uma opção de entrega para este CEP.";

export function publicShippingMessage(code: string) {
  if (code === "invalid_postal_code") return POSTAL_CODE_MESSAGES.invalid;
  if (code === "postal_code_not_found") return POSTAL_CODE_MESSAGES.notFound;
  if (code === "postal_code_service_unavailable") return POSTAL_CODE_MESSAGES.unavailable;
  if (code === "shipping_service_unavailable") return SHIPPING_NO_COVERAGE_MESSAGE;
  return SHIPPING_UNAVAILABLE_MESSAGE;
}
