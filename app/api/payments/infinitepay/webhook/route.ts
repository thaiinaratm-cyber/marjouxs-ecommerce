import { apiError, checkoutJson, validationError } from "@/lib/checkout/http";
import { InfinitePayError } from "@/lib/checkout/infinitepay";
import { infinitePayWebhookSchema } from "@/lib/checkout/schemas";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { verifyInfinitePayPayment } from "@/lib/checkout/verify-payment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = infinitePayWebhookSchema.safeParse(await request.json());
    if (!parsed.success) return validationError();

    const { data: attempt, error } = await getSupabaseAdmin()
      .from("ecommerce_payment_attempts")
      .select("id, order_id, requested_amount_cents, provider_checkout_id, transaction_nsu, status")
      .eq("order_nsu", parsed.data.order_nsu)
      .maybeSingle();
    if (error) throw new InfinitePayError("Não foi possível localizar a tentativa.", "payment_attempt_read_failed", 503);
    if (!attempt) {
      return checkoutJson({ error: "Pedido não encontrado.", code: "attempt_not_found" }, { status: 404 });
    }
    const result = await verifyInfinitePayPayment(attempt, {
      orderNsu: parsed.data.order_nsu,
      transactionNsu: parsed.data.transaction_nsu,
      invoiceSlug: parsed.data.invoice_slug,
      receiptUrl: parsed.data.receipt_url
    });
    return checkoutJson(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof InfinitePayError) {
      return checkoutJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return apiError(error);
  }
}
