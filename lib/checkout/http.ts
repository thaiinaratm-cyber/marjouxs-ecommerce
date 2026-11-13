import { NextResponse } from "next/server";
import { CheckoutConfigurationError } from "@/lib/checkout/config";
import { CheckoutValidationError } from "@/lib/checkout/catalog";
import { CheckoutCatalogReadError } from "@/lib/checkout/catalog-server";

export function checkoutJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Referrer-Policy", "no-referrer");
  return NextResponse.json(body, { ...init, headers });
}

export function apiError(error: unknown) {
  if (error instanceof CheckoutValidationError) {
    return checkoutJson({ error: error.message, code: error.code, ...error.details }, { status: error.status });
  }

  if (error instanceof CheckoutCatalogReadError) {
    return checkoutJson(
      { error: "O catálogo está temporariamente indisponível.", code: "checkout_catalog_unavailable" },
      { status: 503 }
    );
  }

  if (error instanceof CheckoutConfigurationError) {
    return checkoutJson({ error: error.message, code: error.code }, { status: 503 });
  }

  if (error instanceof SyntaxError) {
    return checkoutJson({ error: "O corpo da requisição é inválido.", code: "invalid_json" }, { status: 400 });
  }

  console.error("checkout_request_failure", { code: "internal_error" });
  return checkoutJson(
    { error: "Não foi possível concluir a solicitação agora.", code: "internal_error" },
    { status: 500 }
  );
}

export function validationError() {
  return checkoutJson(
    { error: "Revise os dados informados e tente novamente.", code: "invalid_request" },
    { status: 400 }
  );
}
