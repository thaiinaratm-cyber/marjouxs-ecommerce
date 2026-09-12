import { describe, expect, it, vi } from "vitest";
import {
  checkoutRpcError,
  logCheckoutFailure,
  requestValidationError
} from "@/lib/checkout/diagnostics";

describe("checkout diagnostics", () => {
  it("registra somente a projeção segura de um erro do Supabase", () => {
    const failure = checkoutRpcError(
      {
        code: "23514",
        message:
          'new row violates check constraint "ecommerce_order_items_values_ck"',
        details: "Failing row contains (cliente@example.com, 11999999999, 12345678901)."
      },
      "ecommerce_create_checkout"
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logCheckoutFailure(failure);

    const serializedLog = consoleSpy.mock.calls.flat().join(" ");
    expect(failure.publicCode).toBe("checkout_order_creation_error");
    expect(failure.diagnostic).toMatchObject({
      stage: "ecommerce_order_items",
      http_status: 500,
      error_code: "check_violation",
      postgres_code: "23514",
      constraint_name: "ecommerce_order_items_values_ck",
      rpc_name: "ecommerce_create_checkout",
      order_nsu: null
    });
    expect(serializedLog).not.toContain("cliente@example.com");
    expect(serializedLog).not.toContain("11999999999");
    expect(serializedLog).not.toContain("12345678901");
  });

  it("distingue falha na tentativa de pagamento", () => {
    const failure = checkoutRpcError(
      {
        code: "23505",
        message:
          'duplicate key violates unique constraint "ecommerce_payment_attempts_order_nsu_key"'
      },
      "ecommerce_create_checkout"
    );

    expect(failure).toMatchObject({
      publicCode: "checkout_payment_attempt_error",
      status: 409,
      diagnostic: {
        stage: "ecommerce_payment_attempts",
        postgres_code: "23505",
        error_code: "unique_violation",
        constraint_name: "ecommerce_payment_attempts_order_nsu_key"
      }
    });
  });

  it("classifica CPF inválido apenas como validação do cliente", () => {
    const failure = requestValidationError([["customer", "cpf"]]);

    expect(failure).toMatchObject({
      publicCode: "checkout_validation_error",
      status: 400,
      diagnostic: {
        stage: "customer_validation",
        postgres_code: null,
        constraint_name: null,
        order_nsu: null
      }
    });
  });
});
