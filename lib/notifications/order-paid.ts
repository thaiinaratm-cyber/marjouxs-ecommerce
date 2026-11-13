// Shared by Next server routes and the standalone Netlify worker.
// The server-only sentinel package cannot run in a standalone Node worker.
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { ORDER_SNAPSHOT_SELECT } from "@/lib/orders/selects";
import type { OrderSnapshot } from "@/lib/orders/model";
import { buildOrderPaidEmail, getOrderNotificationConfig, orderEmailSnapshotSchema, OrderNotificationError, type NotificationMessage } from "@/lib/notifications/order-email";

if (typeof window !== "undefined") throw new Error("order_notifications_server_only");

export type PaidEvent = { result_id: string; result_order_id: string; result_lock_token: string; result_payload: Record<string, unknown> };
type FrozenNotification = { prepared_at: string; message: NotificationMessage };
function paidPayload(order: OrderSnapshot) {
  const snapshot = orderEmailSnapshotSchema.safeParse(order);
  if (!snapshot.success) throw new OrderNotificationError("notification_order_snapshot_invalid");
  return { snapshot_version: 1, order_id: order.id, ...snapshot.data };
}
export async function ensurePaidOrderEvent(orderId: string) {
  const client = getSupabaseAdmin();
  const order = await client.from("ecommerce_orders").select(ORDER_SNAPSHOT_SELECT)
    .eq("id", orderId).eq("payment_status", "paid").maybeSingle();
  if (order.error) throw new OrderNotificationError("notification_order_read_failed");
  if (!order.data?.paid_at) return false;
  const result = await client.from("ecommerce_integration_outbox").upsert({
    order_id: orderId, event_type: "order.paid", payload: paidPayload(order.data as unknown as OrderSnapshot)
  }, { onConflict: "order_id,event_type", ignoreDuplicates: true });
  if (result.error?.code === "23505") {
    const existing = await client.from("ecommerce_integration_outbox").select("id")
      .eq("order_id", orderId).eq("event_type", "order.paid").maybeSingle();
    if (!existing.error && existing.data) return true;
  }
  if (result.error) throw new OrderNotificationError("notification_event_write_failed");
  return true;
}

// Repair the gap after a confirmed payment if the webhook's enqueue failed.
// This uses the existing worker and UNIQUE key; it creates no new retry system.
export async function reconcilePaidOrderEvents(limit = 20) {
  const { data, error } = await getSupabaseAdmin().from("ecommerce_orders")
    .select("id,ecommerce_integration_outbox!left(id)")
    .eq("payment_status", "paid").eq("ecommerce_integration_outbox.event_type", "order.paid")
    .is("ecommerce_integration_outbox", null).order("created_at").limit(limit);
  if (error) throw new OrderNotificationError("notification_reconciliation_failed");
  for (const order of data ?? []) await ensurePaidOrderEvent(order.id);
}

function frozenMessage(value: unknown): FrozenNotification | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object") throw new OrderNotificationError("notification_snapshot_invalid");
  const stored = value as FrozenNotification;
  const message = stored.message;
  if (!Number.isFinite(Date.parse(stored.prepared_at)) || !message || !Array.isArray(message.to) ||
      !message.to.length || !message.to.every((item) => typeof item === "string") ||
      [message.from, message.subject, message.html, message.text].some((item) => typeof item !== "string")) {
    throw new OrderNotificationError("notification_snapshot_invalid");
  }
  return stored;
}
export async function sendOrderPaidEmail(event: PaidEvent, fetcher: typeof fetch = fetch, now = Date.now()) {
  const config = getOrderNotificationConfig();
  if (!config) return false;
  const client = getSupabaseAdmin();
  const order = await client.from("ecommerce_orders").select("id,paid_at")
    .eq("id", event.result_order_id).eq("payment_status", "paid").maybeSingle();
  if (order.error || !order.data?.paid_at) throw new OrderNotificationError("notification_paid_order_unavailable");
  let frozen = frozenMessage(event.result_payload.notification);
  if (!frozen) {
    let snapshot;
    if (event.result_payload.snapshot_version === 1) {
      snapshot = orderEmailSnapshotSchema.safeParse(event.result_payload);
    } else {
      // Compatibility with events created before purchase snapshots were frozen at enqueue.
      const legacy = await client.from("ecommerce_orders").select(ORDER_SNAPSHOT_SELECT)
        .eq("id", event.result_order_id).eq("payment_status", "paid").maybeSingle();
      if (legacy.error) throw new OrderNotificationError("notification_order_read_failed");
      snapshot = orderEmailSnapshotSchema.safeParse(legacy.data);
    }
    if (!snapshot.success || snapshot.data.id !== event.result_order_id) {
      throw new OrderNotificationError("notification_order_snapshot_invalid");
    }
    frozen = { prepared_at: new Date(now).toISOString(), message: buildOrderPaidEmail(snapshot.data, config) };
    const saved = await client.from("ecommerce_integration_outbox")
      .update({ payload: { ...event.result_payload, notification: frozen } })
      .eq("id", event.result_id).eq("status", "processing").eq("lock_token", event.result_lock_token).select("id").maybeSingle();
    if (saved.error || !saved.data) throw new OrderNotificationError("notification_lock_or_snapshot_failed");
  }
  // Resend retains idempotency keys for 24h. Never automatically resend an
  // ambiguous request after that window; retain failed state for manual review.
  const age = now - Date.parse(frozen.prepared_at);
  if (age < 0 || age >= 23 * 60 * 60 * 1000) throw new OrderNotificationError("notification_retry_review_required");
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", { method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `marjouxs/order.paid/${event.result_id}` },
      // JSONB can reorder object keys on read; keep the HTTP body deterministic.
      body: JSON.stringify({ from: frozen.message.from, to: frozen.message.to,
        subject: frozen.message.subject, html: frozen.message.html, text: frozen.message.text }),
      signal: AbortSignal.timeout(15000) });
  } catch { throw new OrderNotificationError("notification_provider_unavailable"); }
  if (!response.ok) throw new OrderNotificationError(`notification_provider_http_${response.status}`);
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id) {
    throw new OrderNotificationError("notification_provider_response_invalid");
  }
  return true;
}
