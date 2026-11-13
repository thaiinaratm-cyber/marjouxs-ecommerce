import { z } from "zod";
import { createCheckoutProcessError } from "@/lib/checkout/diagnostics";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";

export const CHECKOUT_LINK_RPC = "ecommerce_checkout_link_transition";
export type CheckoutLinkAction = "claim" | "begin_dispatch" | "complete";

const outcomeSchema = z.enum([
  "reserved", "in_progress", "dispatch_granted", "dispatch_uncertain",
  "legacy_dispatch_unknown", "dispatch_state_invalid", "stale_claim", "reuse_link",
  "already_paid", "attempt_not_available", "registered", "already_registered",
  "provider_checkout_id_conflict", "checkout_url_conflict", "provider_checkout_id_reused",
  "attempt_not_mutable"
]);
const rowSchema = z.object({
  result_code: outcomeSchema,
  result_attempt_id: z.string().uuid(),
  result_attempt_status: z.enum(["creating", "pending", "paid", "failed", "requires_review"]),
  result_checkout_url: z.string().nullable(),
  result_provider_checkout_id: z.string().nullable(),
  result_lease_expires_at: z.string().nullable()
});
export type CheckoutLinkTransition = z.infer<typeof rowSchema>;

export function checkoutLinkError(
  code: "checkout_link_in_progress" | "checkout_link_dispatch_uncertain" |
    "checkout_link_legacy_unknown" | "checkout_link_unavailable" | "checkout_link_state_invalid",
  outcome: string = code,
  postgresCode: string | null = null
) {
  const messages = {
    checkout_link_in_progress: "Seu pagamento está sendo preparado. Aguarde alguns instantes e tente novamente.",
    checkout_link_dispatch_uncertain: "Precisamos conferir esta tentativa de pagamento. Fale com nossa equipe antes de tentar novamente.",
    checkout_link_legacy_unknown: "Esta tentativa de pagamento precisa ser conferida pela nossa equipe.",
    checkout_link_unavailable: "Não foi possível preparar o pagamento com segurança. Tente novamente em instantes.",
    checkout_link_state_invalid: "Este pagamento precisa de atendimento antes de continuar."
  };
  return createCheckoutProcessError({
    publicMessage: messages[code], publicCode: code,
    status: code === "checkout_link_unavailable" ? 503 : 409,
    diagnostic: {
      stage: "ecommerce_payment_attempts", error_code: outcome, postgres_code: postgresCode,
      constraint_name: null, rpc_name: CHECKOUT_LINK_RPC, order_nsu: null
    }
  });
}

export function blockedCheckoutLink(result: CheckoutLinkTransition): never {
  switch (result.result_code) {
    case "in_progress":
    case "stale_claim": throw checkoutLinkError("checkout_link_in_progress", result.result_code);
    case "dispatch_uncertain": throw checkoutLinkError("checkout_link_dispatch_uncertain", result.result_code);
    case "legacy_dispatch_unknown": throw checkoutLinkError("checkout_link_legacy_unknown", result.result_code);
    default: throw checkoutLinkError("checkout_link_state_invalid", result.result_code);
  }
}

export async function transitionCheckoutLink(
  attemptId: string,
  action: CheckoutLinkAction,
  claimToken: string,
  link?: { checkoutUrl: string; providerCheckoutId: string }
): Promise<CheckoutLinkTransition> {
  let response: { data: unknown; error: { code?: unknown } | null };
  try {
    response = await getSupabaseAdmin().rpc(CHECKOUT_LINK_RPC, {
      p_attempt_id: attemptId, p_action: action, p_claim_token: claimToken,
      ...(link ? { p_checkout_url: link.checkoutUrl, p_provider_checkout_id: link.providerCheckoutId } : {})
    });
  } catch {
    throw checkoutLinkError("checkout_link_unavailable", "transition_transport_error");
  }
  if (response.error) {
    const code = typeof response.error.code === "string" && /^[A-Z0-9]{5,8}$/.test(response.error.code)
      ? response.error.code : null;
    throw checkoutLinkError("checkout_link_unavailable", "transition_rpc_error", code);
  }
  const rows: unknown = response.data;
  const parsed = rowSchema.safeParse(Array.isArray(rows) && rows.length === 1 ? rows[0] : null);
  if (!parsed.success || parsed.data.result_attempt_id !== attemptId) {
    throw checkoutLinkError("checkout_link_unavailable", "invalid_transition_response");
  }
  const result = parsed.data;
  const hasLink = ["registered", "already_registered", "reuse_link"].includes(result.result_code);
  const needsLease = ["reserved", "dispatch_granted"].includes(result.result_code);
  if (
    (hasLink && (result.result_attempt_status !== "pending" ||
      !z.url({ protocol: /^https$/ }).safeParse(result.result_checkout_url).success ||
      !result.result_provider_checkout_id?.trim())) ||
    (needsLease && (result.result_attempt_status !== "creating" ||
      !result.result_lease_expires_at || !Number.isFinite(Date.parse(result.result_lease_expires_at))))
  ) throw checkoutLinkError("checkout_link_unavailable", "invalid_transition_response");

  console.info("checkout_link_transition", JSON.stringify({
    attempt_id: `${attemptId.slice(0, 8)}...${attemptId.slice(-4)}`,
    transition: action, outcome: result.result_code,
    provider_call_allowed: action === "begin_dispatch" && result.result_code === "dispatch_granted"
  }));
  return result;
}
