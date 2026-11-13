import { describe, expect, it } from "vitest";
import { publicShippingMessage, SHIPPING_UNAVAILABLE_MESSAGE, SHIPPING_NO_COVERAGE_MESSAGE } from "@/lib/checkout/shipping-messages";
import { POSTAL_CODE_MESSAGES } from "@/lib/checkout/postal-code";

describe("mensagens públicas de frete", () => {
  it.each(["shipping_provider_timeout", "shipping_provider_unavailable", "shipping_provider_rate_limited",
    "melhor_envio_oauth_invalid", "melhor_envio_local_sandbox_token_invalid", "invalid_shipping_response",
    "shipping_endpoint_invalid", "missing_configuration"])("%s não expõe detalhes técnicos", (code) => {
    expect(publicShippingMessage(code)).toBe(SHIPPING_UNAVAILABLE_MESSAGE);
  });
  it("preserva mensagens distintas de CEP e cobertura", () => {
    expect(publicShippingMessage("invalid_postal_code")).toBe(POSTAL_CODE_MESSAGES.invalid);
    expect(publicShippingMessage("postal_code_not_found")).toBe(POSTAL_CODE_MESSAGES.notFound);
    expect(publicShippingMessage("postal_code_service_unavailable")).toBe(POSTAL_CODE_MESSAGES.unavailable);
    expect(publicShippingMessage("shipping_service_unavailable")).toBe(SHIPPING_NO_COVERAGE_MESSAGE);
  });
});
