import { randomUUID } from "node:crypto";
import { CheckoutValidationError } from "@/lib/checkout/catalog";
import { blockedCheckoutLink, checkoutLinkError, transitionCheckoutLink } from "@/lib/checkout/checkout-link";
import { resolveAuthoritativeCheckoutCart } from "@/lib/checkout/catalog-server";
import {
  CheckoutProcessError,
  checkoutRpcError,
  createCheckoutProcessError,
  logCheckoutFailure,
  logCheckoutRpcSuccess,
  withOrderNsu
} from "@/lib/checkout/diagnostics";
import { checkoutIdempotencyKey, checkoutRequestHash } from "@/lib/checkout/hash";
import { checkoutIntentSnapshot } from "@/lib/checkout/intent";
import {
  prepareInfinitePayCheckout,
  InfinitePayLinkError,
  InfinitePayError,
  type InfinitePayCheckoutItem
} from "@/lib/checkout/infinitepay";
import { quoteShipping } from "@/lib/checkout/shipping";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import type { createCheckoutSchema } from "@/lib/checkout/schemas";
import type { z } from "zod";
import type { ValidatedCart } from "@/types/checkout";

type CheckoutRequest = z.infer<typeof createCheckoutSchema>;

type CreateCheckoutRpcRow = {
  result_order_id: string;
  result_order_number: string;
  result_public_token: string;
  result_payment_attempt_id: string;
  result_order_nsu: string;
  result_total_cents: number;
  result_attempt_status: string;
  result_checkout_url: string | null;
};

const attemptLocks = new Map<string, Promise<CheckoutResult>>();

export type CheckoutResult = {
  orderNumber: string;
  publicToken: string;
  checkoutUrl: string;
  confirmationUrl: string;
  totalCents: number;
  alreadyPaid: boolean;
  reusedLink: boolean;
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `+${digits.startsWith("55") ? digits : `55${digits}`}`;
}

function getRpcRow<T>(value: unknown, operation: string): T {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    throw new Error(`A RPC ${operation} não retornou dados.`);
  }
  return row as T;
}

async function failAttempt(
  attemptId: string,
  orderNsu: string,
  error: unknown,
  requiresReview = false
) {
  const supabase = getSupabaseAdmin();
  const code =
    error instanceof InfinitePayError
      ? error.code
      : error instanceof CheckoutProcessError
        ? error.publicCode
        : "checkout_link_failed";
  const detail = error instanceof Error ? error.message : "Falha desconhecida ao criar checkout";
  const { error: rpcError } = await supabase.rpc("ecommerce_fail_payment_attempt", {
    p_attempt_id: attemptId,
    p_failure_code: code,
    p_failure_detail: detail,
    p_requires_review: requiresReview
  });

  if (rpcError) {
    logCheckoutFailure(checkoutRpcError(rpcError, "ecommerce_fail_payment_attempt", orderNsu));
  }
}

async function createProviderLink(
  rpcCheckout: CreateCheckoutRpcRow,
  request: CheckoutRequest,
  cart: ValidatedCart,
  shipping: Awaited<ReturnType<typeof quoteShipping>>[number] | null,
  siteUrl: string
): Promise<CheckoutResult> {
  const confirmationUrl = `${siteUrl}/pedido/confirmacao?token=${rpcCheckout.result_public_token}`;

  const claimToken = randomUUID();
  const attemptId = rpcCheckout.result_payment_attempt_id;
  const resultFor = (checkoutUrl: string, alreadyPaid = false, reusedLink = false): CheckoutResult => ({
      orderNumber: rpcCheckout.result_order_number,
      publicToken: rpcCheckout.result_public_token,
      checkoutUrl,
      confirmationUrl,
      totalCents: Number(rpcCheckout.result_total_cents),
      alreadyPaid,
      reusedLink
  });
  const reusedResult = (row: Awaited<ReturnType<typeof transitionCheckoutLink>>) => {
    if (row.result_code === "already_paid") return resultFor(confirmationUrl, true);
    if (row.result_code === "reuse_link") return resultFor(row.result_checkout_url!, false, true);
    return null;
  };
  const claim = await transitionCheckoutLink(attemptId, "claim", claimToken);
  const existing = reusedResult(claim);
  if (existing) return existing;
  if (claim.result_code !== "reserved") blockedCheckoutLink(claim);

  const providerItems: InfinitePayCheckoutItem[] = cart.items.map((item) => ({
    quantity: item.quantity,
    price: item.unitPriceCents,
    description: item.name.slice(0, 200)
  }));
  if (shipping) {
    providerItems.push({
      quantity: 1,
      price: shipping.priceCents,
      description: `Frete - ${shipping.carrierName} ${shipping.serviceName}`.slice(0, 200)
    });
  }

  const sendProvider = prepareInfinitePayCheckout({
      orderNsu: rpcCheckout.result_order_nsu,
      redirectUrl: confirmationUrl,
      webhookUrl: `${siteUrl}/api/payments/infinitepay/webhook`,
      items: providerItems,
      customer: {
        name: request.customer.name,
        email: request.customer.email,
        phoneNumber: normalizePhone(request.customer.phone)
      },
      ...(request.delivery.method === "shipping"
        ? {
            address: {
              cep: request.delivery.address.postalCode,
              street: request.delivery.address.street,
              neighborhood: request.delivery.address.neighborhood,
              number: request.delivery.address.number,
              ...(request.delivery.address.complement
                ? { complement: request.delivery.address.complement }
                : {})
            }
          }
        : {})
    });
  let dispatch: Awaited<ReturnType<typeof transitionCheckoutLink>>;
  try {
    dispatch = await transitionCheckoutLink(attemptId, "begin_dispatch", claimToken);
  } catch {
    throw checkoutLinkError("checkout_link_dispatch_uncertain");
  }
  const reused = reusedResult(dispatch);
  if (reused) return reused;
  if (dispatch.result_code !== "dispatch_granted") blockedCheckoutLink(dispatch);

  let provider: Awaited<ReturnType<typeof sendProvider>>;
  try {
    provider = await sendProvider();
  } catch (error) {
    if (error instanceof InfinitePayLinkError && error.outcome === "rejected") {
      await failAttempt(attemptId, rpcCheckout.result_order_nsu, error);
      throw withOrderNsu(error, rpcCheckout.result_order_nsu);
    }
    // Once dispatch was committed, no unknown result can authorize a second HTTP call.
    throw checkoutLinkError("checkout_link_dispatch_uncertain");
  }

  let completed: Awaited<ReturnType<typeof transitionCheckoutLink>>;
  try {
    completed = await transitionCheckoutLink(attemptId, "complete", claimToken, provider);
  } catch {
    // Completion may have committed even when its response was lost. Retry only reads/reuses.
    throw checkoutLinkError("checkout_link_dispatch_uncertain");
  }
  const completedReuse = reusedResult(completed);
  if (completedReuse) return completedReuse;
  if (completed.result_code === "registered" || completed.result_code === "already_registered") {
    return resultFor(completed.result_checkout_url!, false, completed.result_code === "already_registered");
  }
  blockedCheckoutLink(completed);
}

export async function createCheckout(request: CheckoutRequest, siteUrl: string) {
  const cart = await resolveAuthoritativeCheckoutCart(request.items);
  let selectedShipping: Awaited<ReturnType<typeof quoteShipping>>[number] | null = null;

  if (request.delivery.method === "shipping") {
    const shippingAddress = request.delivery.address;
    const quotes = await quoteShipping(shippingAddress.postalCode, cart.subtotalCents);
    selectedShipping = quotes.find(
      (quote) => quote.serviceId === shippingAddress.serviceId
    ) ?? null;

    if (!selectedShipping) {
      throw new CheckoutValidationError(
        "A modalidade de frete selecionada não está mais disponível.",
        "shipping_service_unavailable",
        422
      );
    }
  }

  const shippingCents = selectedShipping?.priceCents ?? 0;
  const totalCents = cart.subtotalCents + shippingCents;
  if (!Number.isSafeInteger(totalCents)) {
    throw new CheckoutValidationError("O total do pedido é inválido.", "invalid_checkout_total");
  }

  const requestHash = checkoutRequestHash(checkoutIntentSnapshot({
    customer: request.customer,
    delivery: request.delivery,
    items: cart.items.map((item) => ({ ...item, displayedUnitPriceCents: item.unitPriceCents })),
    shippingCents,
    totalCents
  }));
  const idempotencyKey = checkoutIdempotencyKey(request.requestId);
  const orderPayload = {
    customer_name: request.customer.name,
    customer_phone: request.customer.phone,
    customer_email: request.customer.email,
    customer_cpf: request.customer.cpf || null,
    delivery_method: request.delivery.method,
    subtotal_cents: cart.subtotalCents,
    shipping_cents: shippingCents,
    discount_cents: 0,
    total_cents: totalCents,
    ga_client_id: request.analytics?.clientId ?? null,
    ga_session_id: request.analytics?.sessionId ?? null,
    ...(request.delivery.method === "shipping" && selectedShipping
      ? {
          shipping_zip: request.delivery.address.postalCode,
          shipping_street: request.delivery.address.street,
          shipping_number: request.delivery.address.number,
          shipping_complement: request.delivery.address.complement || null,
          shipping_neighborhood: request.delivery.address.neighborhood,
          shipping_city: request.delivery.address.city,
          shipping_state: request.delivery.address.state,
          shipping_carrier: selectedShipping.carrierName,
          shipping_service: selectedShipping.serviceName,
          shipping_service_id: selectedShipping.serviceId,
          shipping_quote_id: selectedShipping.shippingQuoteId,
          shipping_quoted_at: selectedShipping.quotedAt,
          shipping_deadline_days: selectedShipping.deliveryTimeDays
        }
      : {})
  };
  const itemPayload = cart.items.map((item) => ({
    product_id: item.productId,
    product_slug: item.productSlug,
    product_name: item.name,
    product_image: item.image,
    category: item.category,
    subcategory: item.subcategory,
    material: item.material,
    availability: item.availability,
    unit_price_cents: item.unitPriceCents,
    quantity: item.quantity,
    customization: item.customization
  }));

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("ecommerce_create_checkout", {
    p_order: orderPayload,
    p_items: itemPayload,
    p_checkout_idempotency_key: idempotencyKey,
    p_request_hash: requestHash
  });
  if (error) {
    throw checkoutRpcError(error, "ecommerce_create_checkout");
  }

  let rpcCheckout: CreateCheckoutRpcRow;
  try {
    rpcCheckout = getRpcRow<CreateCheckoutRpcRow>(data, "ecommerce_create_checkout");
  } catch {
    throw createCheckoutProcessError({
      publicMessage: "Não foi possível criar o pedido.",
      publicCode: "checkout_order_creation_error",
      status: 500,
      diagnostic: {
        stage: "ecommerce_create_checkout_response",
        error_code: "invalid_rpc_response",
        postgres_code: null,
        constraint_name: null,
        rpc_name: "ecommerce_create_checkout",
        order_nsu: null
      }
    });
  }
  logCheckoutRpcSuccess("ecommerce_create_checkout", rpcCheckout.result_order_nsu);
  if (Number(rpcCheckout.result_total_cents) !== totalCents) {
    throw new CheckoutValidationError(
      "O total salvo não corresponde ao total calculado.",
      "persisted_total_mismatch",
      409
    );
  }

  const existingLock = attemptLocks.get(rpcCheckout.result_payment_attempt_id);
  if (existingLock) {
    return existingLock;
  }

  const operation = createProviderLink(rpcCheckout, request, cart, selectedShipping, siteUrl);
  attemptLocks.set(rpcCheckout.result_payment_attempt_id, operation);
  try {
    return await operation;
  } finally {
    attemptLocks.delete(rpcCheckout.result_payment_attempt_id);
  }
}
