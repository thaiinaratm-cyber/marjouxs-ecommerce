import { CheckoutValidationError } from "@/lib/checkout/catalog";
import { CheckoutConfigurationError } from "@/lib/checkout/config";
import { InfinitePayError } from "@/lib/checkout/infinitepay";
import { ShippingProviderError } from "@/lib/checkout/shipping";

export type CheckoutFailureStage =
  | "request_payload_validation"
  | "cart_validation"
  | "price_recalculation"
  | "customer_validation"
  | "pickup_validation"
  | "shipping_validation"
  | "ecommerce_create_checkout"
  | "ecommerce_create_checkout_response"
  | "ecommerce_orders"
  | "ecommerce_order_items"
  | "ecommerce_payment_attempts"
  | "infinitepay_links"
  | "checkout_configuration"
  | "internal_error";

export type CheckoutDiagnosticEntry = {
  stage: CheckoutFailureStage;
  http_status: number;
  error_code: string | null;
  postgres_code: string | null;
  constraint_name: string | null;
  rpc_name: string | null;
  order_nsu: string | null;
};

type SupabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

type CheckoutProcessErrorInput = {
  publicMessage: string;
  publicCode: string;
  status: number;
  diagnostic: Omit<CheckoutDiagnosticEntry, "http_status">;
};

const SUPABASE_ERROR_NAMES: Record<string, string> = {
  "22023": "invalid_parameter_value",
  "22P02": "invalid_text_representation",
  "23502": "not_null_violation",
  "23503": "foreign_key_violation",
  "23505": "unique_violation",
  "23514": "check_violation",
  "42501": "insufficient_privilege",
  "42883": "undefined_function",
  "42P01": "undefined_table",
  PGRST202: "rpc_not_found"
};

const RPC_ERROR_NAMES: Array<[needle: string, errorName: string]> = [
  ["invalid checkout idempotency key", "invalid_checkout_idempotency_key"],
  ["invalid checkout request hash", "invalid_checkout_request_hash"],
  ["idempotency key was already used", "checkout_idempotency_conflict"],
  ["existing checkout has no associated payment attempt", "payment_attempt_missing"],
  ["p_order must be a json object", "invalid_order_payload"],
  ["p_items must be a non-empty json array", "invalid_items_payload"],
  ["customer name, phone and email are required", "invalid_customer_fields"],
  ["invalid delivery method", "invalid_delivery_method"],
  ["invalid checkout values", "invalid_checkout_values"],
  ["discounts are not enabled", "unexpected_checkout_discount"],
  ["checkout total mismatch", "checkout_total_mismatch"],
  ["pickup orders cannot have a shipping charge", "invalid_pickup_shipping_charge"],
  ["shipping address or service is incomplete", "incomplete_shipping_data"],
  ["invalid shipping deadline", "invalid_shipping_deadline"],
  ["every order item must be a json object", "invalid_order_item_payload"],
  ["order item snapshot is incomplete", "incomplete_order_item_snapshot"],
  ["product is not eligible for checkout", "ineligible_order_item"],
  ["order item quantity or price is invalid", "invalid_order_item_value"],
  ["an alliance pair must have quantity 1", "invalid_alliance_quantity"],
  ["alliance pair customization is invalid", "invalid_alliance_customization"],
  ["customization is not supported", "unsupported_item_customization"],
  ["order item subtotal does not match", "order_items_subtotal_mismatch"],
  ["concurrent checkout creation could not be resolved", "checkout_concurrency_error"]
];

export class CheckoutProcessError extends Error {
  readonly diagnostic: CheckoutDiagnosticEntry;

  constructor(
    readonly publicMessage: string,
    readonly publicCode: string,
    readonly status: number,
    diagnostic: Omit<CheckoutDiagnosticEntry, "http_status">
  ) {
    super(publicMessage);
    this.name = "CheckoutProcessError";
    this.diagnostic = { ...diagnostic, http_status: status };
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sanitizeSupabaseCode(value: unknown) {
  const code = stringValue(value).toUpperCase();
  return /^[A-Z0-9_]{1,32}$/.test(code) ? code : null;
}

function extractConstraint(error: SupabaseErrorLike) {
  const diagnosticText = `${stringValue(error.message)} ${stringValue(error.details)}`;
  const ecommerceConstraint = diagnosticText.match(
    /\b(ecommerce_(?:orders|order_items|payment_attempts)_[a-z0-9_]+)\b/i
  );
  if (ecommerceConstraint) {
    return ecommerceConstraint[1].toLowerCase();
  }

  const namedConstraint = diagnosticText.match(/\bconstraint\s+["']?([a-z0-9_]{1,128})["']?/i);
  return namedConstraint?.[1]?.toLowerCase() ?? null;
}

function knownRpcError(message: string) {
  const normalized = message.toLowerCase();
  return RPC_ERROR_NAMES.find(([needle]) => normalized.includes(needle))?.[1] ?? null;
}

function stageForSupabaseError(
  rpc: string,
  constraint: string | null,
  sanitizedError: string,
  message: string
): CheckoutFailureStage {
  if (rpc !== "ecommerce_create_checkout") {
    return "ecommerce_payment_attempts";
  }
  if (constraint?.startsWith("ecommerce_orders_")) {
    return "ecommerce_orders";
  }
  if (constraint?.startsWith("ecommerce_order_items_")) {
    return "ecommerce_order_items";
  }
  if (constraint?.startsWith("ecommerce_payment_attempts_")) {
    return "ecommerce_payment_attempts";
  }
  if (sanitizedError === "invalid_customer_fields") {
    return "customer_validation";
  }
  if (sanitizedError.includes("pickup") || sanitizedError === "invalid_delivery_method") {
    return "pickup_validation";
  }
  if (sanitizedError.startsWith("incomplete_shipping") || sanitizedError.startsWith("invalid_shipping")) {
    return "shipping_validation";
  }
  if (sanitizedError.includes("subtotal") || sanitizedError.includes("checkout_total")) {
    return "price_recalculation";
  }
  if (
    sanitizedError.includes("order_item") ||
    sanitizedError.includes("alliance") ||
    sanitizedError.includes("customization") ||
    sanitizedError === "ineligible_order_item"
  ) {
    return "ecommerce_order_items";
  }
  if (sanitizedError.includes("payment_attempt") || message.toLowerCase().includes("payment attempt")) {
    return "ecommerce_payment_attempts";
  }
  return "ecommerce_create_checkout";
}

function publicErrorForStage(stage: CheckoutFailureStage) {
  if (stage === "ecommerce_payment_attempts") {
    return {
      message: "Não foi possível preparar a tentativa de pagamento.",
      code: "checkout_payment_attempt_error"
    };
  }
  if (
    stage === "cart_validation" ||
    stage === "price_recalculation" ||
    stage === "customer_validation" ||
    stage === "pickup_validation" ||
    stage === "shipping_validation"
  ) {
    return {
      message: "Não foi possível validar os dados do pedido.",
      code: "checkout_validation_error"
    };
  }
  return { message: "Não foi possível criar o pedido.", code: "checkout_order_creation_error" };
}

export function createCheckoutProcessError(input: CheckoutProcessErrorInput) {
  return new CheckoutProcessError(
    input.publicMessage,
    input.publicCode,
    input.status,
    input.diagnostic
  );
}

export function checkoutRpcError(
  error: SupabaseErrorLike,
  rpc: string,
  orderNsu: string | null = null
) {
  const supabaseCode = sanitizeSupabaseCode(error.code);
  const message = stringValue(error.message);
  const constraint = extractConstraint(error);
  const supabaseError =
    knownRpcError(message) ??
    (supabaseCode ? SUPABASE_ERROR_NAMES[supabaseCode] : null) ??
    "database_error";
  const stage = stageForSupabaseError(rpc, constraint, supabaseError, message);
  const publicError = publicErrorForStage(stage);
  const status = supabaseCode === "23505" ? 409 : 500;

  return new CheckoutProcessError(publicError.message, publicError.code, status, {
    stage,
    error_code: supabaseError,
    postgres_code: supabaseCode,
    constraint_name: constraint,
    rpc_name: rpc,
    order_nsu: orderNsu
  });
}

function stageForValidationCode(code: string): CheckoutFailureStage {
  if (["product_without_price", "invalid_catalog_price", "cart_total_overflow"].includes(code)) {
    return "price_recalculation";
  }
  if (code.startsWith("shipping_")) {
    return "shipping_validation";
  }
  if (code === "payment_attempt_not_available") {
    return "ecommerce_payment_attempts";
  }
  if (code === "persisted_total_mismatch") {
    return "ecommerce_create_checkout_response";
  }
  return "cart_validation";
}

export function requestValidationError(issuePaths: Array<Array<PropertyKey>>) {
  const paths = issuePaths.map((path) => path.map(String).join("."));
  const stage: CheckoutFailureStage = paths.some((path) => path.startsWith("customer"))
    ? "customer_validation"
    : paths.some((path) => path.startsWith("delivery"))
      ? "pickup_validation"
      : paths.some((path) => path.startsWith("items"))
        ? "cart_validation"
        : "request_payload_validation";

  return new CheckoutProcessError(
    "Revise os dados informados e tente novamente.",
    "checkout_validation_error",
    400,
    {
      stage,
      error_code: "request_validation_error",
      postgres_code: null,
      constraint_name: null,
      rpc_name: null,
      order_nsu: null
    }
  );
}

export function toCheckoutProcessError(error: unknown) {
  if (error instanceof CheckoutProcessError) {
    return error;
  }
  if (error instanceof CheckoutValidationError) {
    return new CheckoutProcessError(error.message, error.code, error.status, {
      stage: stageForValidationCode(error.code),
      error_code: error.code,
      postgres_code: null,
      constraint_name: null,
      rpc_name: null,
      order_nsu: null
    });
  }
  if (error instanceof InfinitePayError) {
    return new CheckoutProcessError(
      error.message,
      "infinitepay_link_error",
      error.status,
      {
        stage: "infinitepay_links",
        error_code: "infinitepay_link_error",
        postgres_code: null,
        constraint_name: null,
        rpc_name: null,
        order_nsu: null
      }
    );
  }
  if (error instanceof ShippingProviderError) {
    return new CheckoutProcessError(error.message, "checkout_validation_error", error.status, {
      stage: "shipping_validation",
      error_code: error.code,
      postgres_code: null,
      constraint_name: null,
      rpc_name: null,
      order_nsu: null
    });
  }
  if (error instanceof CheckoutConfigurationError) {
    return new CheckoutProcessError(error.message, error.code, 503, {
      stage: "checkout_configuration",
      error_code: error.code,
      postgres_code: null,
      constraint_name: null,
      rpc_name: null,
      order_nsu: null
    });
  }

  return new CheckoutProcessError(
    "Não foi possível concluir a solicitação agora.",
    "internal_error",
    500,
    {
      stage: "internal_error",
      error_code: "internal_error",
      postgres_code: null,
      constraint_name: null,
      rpc_name: null,
      order_nsu: null
    }
  );
}

export function withOrderNsu(error: unknown, orderNsu: string) {
  const failure = toCheckoutProcessError(error);
  return new CheckoutProcessError(failure.publicMessage, failure.publicCode, failure.status, {
    stage: failure.diagnostic.stage,
    error_code: failure.diagnostic.error_code,
    postgres_code: failure.diagnostic.postgres_code,
    constraint_name: failure.diagnostic.constraint_name,
    rpc_name: failure.diagnostic.rpc_name,
    order_nsu: orderNsu
  });
}

export function logCheckoutFailure(failure: CheckoutProcessError) {
  console.error("checkout_create_failure", JSON.stringify(failure.diagnostic));
}

export function logCheckoutRpcSuccess(rpc: string, orderNsu: string) {
  const entry: CheckoutDiagnosticEntry = {
    stage: rpc === "ecommerce_create_checkout" ? "ecommerce_create_checkout_response" : "ecommerce_payment_attempts",
    http_status: 200,
    error_code: null,
    postgres_code: null,
    constraint_name: null,
    rpc_name: rpc,
    order_nsu: orderNsu
  };
  console.info("checkout_create_rpc_success", JSON.stringify(entry));
}
