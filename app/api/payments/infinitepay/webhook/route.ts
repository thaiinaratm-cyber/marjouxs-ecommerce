import { NextResponse } from "next/server";
import { apiError, validationError } from "@/lib/checkout/http";
import { checkInfinitePayPayment, InfinitePayError } from "@/lib/checkout/infinitepay";
import { infinitePayWebhookSchema } from "@/lib/checkout/schemas";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";

export const runtime = "nodejs";

type ConfirmationRow = {
  result_code: string;
  result_newly_paid: boolean;
  result_order_id: string;
  result_order_number: string;
  result_payment_status: string;
};

function getRow<T>(value: unknown): T | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? (row as T) : null;
}

async function markForReview(attemptId: string, code: string, detail: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("ecommerce_fail_payment_attempt", {
    p_attempt_id: attemptId,
    p_failure_code: code,
    p_failure_detail: detail,
    p_requires_review: true
  });
  if (error) {
    console.error("Could not mark divergent payment for review", error.message);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = infinitePayWebhookSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError();
    }

    const supabase = getSupabaseAdmin();
    const { data: attempt, error: attemptError } = await supabase
      .from("ecommerce_payment_attempts")
      .select("id, requested_amount_cents, provider_checkout_id, transaction_nsu, status")
      .eq("order_nsu", parsed.data.order_nsu)
      .maybeSingle();

    if (attemptError) {
      throw new Error(`Não foi possível localizar a tentativa: ${attemptError.message}`);
    }
    if (!attempt) {
      return NextResponse.json({ error: "Pedido não encontrado.", code: "attempt_not_found" }, { status: 404 });
    }

    const paymentCheck = await checkInfinitePayPayment({
      orderNsu: parsed.data.order_nsu,
      transactionNsu: parsed.data.transaction_nsu,
      invoiceSlug: parsed.data.invoice_slug
    });

    if (!paymentCheck.success || !paymentCheck.paid || paymentCheck.paid_amount <= 0) {
      return NextResponse.json(
        { error: "O pagamento ainda não foi confirmado.", code: "payment_not_confirmed" },
        { status: 400 }
      );
    }

    if (paymentCheck.amount !== Number(attempt.requested_amount_cents)) {
      await markForReview(attempt.id, "payment_amount_mismatch", "Official payment_check amount differs from the requested amount");
      return NextResponse.json(
        { error: "O valor confirmado diverge do pedido.", code: "payment_amount_mismatch" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase.rpc("ecommerce_confirm_payment", {
      p_order_nsu: parsed.data.order_nsu,
      p_provider_checkout_id: parsed.data.invoice_slug,
      p_transaction_nsu: parsed.data.transaction_nsu,
      p_amount_cents: paymentCheck.amount,
      p_paid_amount_cents: paymentCheck.paid_amount,
      p_capture_method: paymentCheck.capture_method,
      p_installments: paymentCheck.installments,
      p_receipt_url: parsed.data.receipt_url ?? null,
      p_payment_verified: true,
      p_check_success: paymentCheck.success,
      p_check_paid: paymentCheck.paid
    });

    if (error) {
      throw new Error(`Não foi possível confirmar o pagamento: ${error.message}`);
    }

    const confirmation = getRow<ConfirmationRow>(data);
    if (!confirmation) {
      throw new Error("A confirmação de pagamento não retornou resultado.");
    }

    if (["paid", "already_paid", "order_already_paid"].includes(confirmation.result_code)) {
      return NextResponse.json({ received: true, code: confirmation.result_code });
    }

    return NextResponse.json(
      { received: false, code: confirmation.result_code },
      { status: confirmation.result_code.endsWith("conflict") ? 409 : 422 }
    );
  } catch (error) {
    if (error instanceof InfinitePayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return apiError(error);
  }
}
