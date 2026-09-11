import { NextResponse } from "next/server";
import { CheckoutConfigurationError } from "@/lib/checkout/config";
import { CheckoutValidationError } from "@/lib/checkout/catalog";

export function apiError(error: unknown) {
  if (error instanceof CheckoutValidationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof CheckoutConfigurationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "O corpo da requisição é inválido.", code: "invalid_json" }, { status: 400 });
  }

  console.error("Checkout request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json(
    { error: "Não foi possível concluir a solicitação agora.", code: "internal_error" },
    { status: 500 }
  );
}

export function validationError() {
  return NextResponse.json(
    { error: "Revise os dados informados e tente novamente.", code: "invalid_request" },
    { status: 400 }
  );
}
