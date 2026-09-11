import { getGa4ServerConfiguration } from "@/lib/checkout/config";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";

type ClaimedOutboxEvent = {
  result_id: string;
  result_order_id: string;
  result_event_type: "ga4_purchase" | "erp_financial";
  result_payload: Record<string, unknown>;
  result_attempt_count: number;
  result_lock_token: string;
};

export type Ga4OrderRow = {
  id: string;
  order_number: string;
  total_cents: number;
  shipping_cents: number;
  ga_client_id: string | null;
  ga_session_id: string | null;
  ecommerce_order_items: Array<{
    product_id: string;
    product_name: string;
    category: string;
    subcategory: string | null;
    material: string | null;
    unit_price_cents: number;
    quantity: number;
  }>;
};

function fallbackClientId(orderId: string) {
  const digits = orderId.replace(/\D/g, "").slice(0, 10) || "1";
  return `${digits}.${Math.floor(Date.now() / 1000)}`;
}

export function buildGa4PurchasePayload(order: Ga4OrderRow) {
  const sessionId =
    order.ga_session_id && /^\d+$/.test(order.ga_session_id)
      ? Number(order.ga_session_id)
      : undefined;

  return {
    client_id: order.ga_client_id || fallbackClientId(order.id),
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: order.order_number,
          currency: "BRL",
          value: Number(order.total_cents) / 100,
          shipping: Number(order.shipping_cents) / 100,
          engagement_time_msec: 100,
          ...(sessionId ? { session_id: sessionId } : {}),
          items: (order.ecommerce_order_items ?? []).map((item) => ({
            item_id: item.product_id,
            item_name: item.product_name,
            item_category: item.category,
            ...(item.subcategory ? { item_category2: item.subcategory } : {}),
            ...(item.material ? { item_variant: item.material } : {}),
            price: Number(item.unit_price_cents) / 100,
            quantity: item.quantity
          }))
        }
      }
    ]
  };
}

export async function sendGa4Purchase(orderId: string, fetchImplementation: typeof fetch = fetch) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ecommerce_orders")
    .select(
      "id, order_number, total_cents, shipping_cents, ga_client_id, ga_session_id, ecommerce_order_items(product_id, product_name, category, subcategory, material, unit_price_cents, quantity)"
    )
    .eq("id", orderId)
    .eq("payment_status", "paid")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Paid order not found for GA4 purchase");
  }

  const order = data as unknown as Ga4OrderRow;
  const { measurementId, apiSecret } = getGa4ServerConfiguration();
  const response = await fetchImplementation(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGa4PurchasePayload(order)),
      signal: AbortSignal.timeout(10_000)
    }
  );

  if (!response.ok) {
    throw new Error(`GA4 Measurement Protocol returned HTTP ${response.status}`);
  }
}

async function completeEvent(event: ClaimedOutboxEvent) {
  const { data, error } = await getSupabaseAdmin().rpc("ecommerce_complete_outbox", {
    p_event_id: event.result_id,
    p_lock_token: event.result_lock_token
  });
  if (error || data !== true) {
    throw new Error(error?.message || "Could not complete the outbox event lock");
  }
}

async function failEvent(event: ClaimedOutboxEvent, processingError: unknown) {
  const message = processingError instanceof Error ? processingError.message : "Unknown outbox error";
  const { error } = await getSupabaseAdmin().rpc("ecommerce_fail_outbox", {
    p_event_id: event.result_id,
    p_lock_token: event.result_lock_token,
    p_error: message
  });
  if (error) {
    console.error("Could not release failed outbox event", error.message);
  }
}

export async function processEcommerceOutbox(batchSize = 5) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("ecommerce_claim_outbox", {
    p_event_types: ["ga4_purchase"],
    p_limit: batchSize
  });

  if (error) {
    throw new Error(`Could not claim ecommerce outbox: ${error.message}`);
  }

  const events = (Array.isArray(data) ? data : []) as ClaimedOutboxEvent[];
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      if (event.result_event_type !== "ga4_purchase") {
        throw new Error(`Unsupported event type: ${event.result_event_type}`);
      }
      await sendGa4Purchase(event.result_order_id);
      await completeEvent(event);
      processed += 1;
    } catch (processingError) {
      await failEvent(event, processingError);
      failed += 1;
    }
  }

  return { claimed: events.length, processed, failed };
}
