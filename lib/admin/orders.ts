import "server-only";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { canSetOrderStatus, ORDERS_PAGE_SIZE, parseOrderQuery, type OrderSnapshot, type OrderStatus, type OrderSummary } from "@/lib/orders/model";
import { ORDER_SNAPSHOT_SELECT, ORDER_SUMMARY_SELECT } from "@/lib/orders/selects";
import { canUseOperationalStatus } from "@/lib/orders/shipment";

function orderReadFailure(stage: "list" | "summary" | "detail", error: { code?: string; message?: string }) {
  const code = /^(?:[A-Z0-9]{5}|PGRST\d+)$/.test(error.code ?? "") ? error.code! : "unknown";
  const column = error.code === "42703"
    ? error.message?.match(/column\s+([a-zA-Z0-9_."]+)\s+does not exist/i)?.[1] ?? null : null;
  // Do not serialize Supabase details/hints, search text, customer data or keys.
  console.error("admin_orders_read_failure", { stage, code, column });
  throw new Error(`admin_orders_${stage}_failed:${code}${column ? `:${column}` : ""}`);
}

// These order tables intentionally have RLS enabled with no browser policies.
// Every admin entry point verifies the cookie session before using the server client.
export async function listAdminOrders(params: Record<string, string | string[] | undefined>) {
  await requireActiveAdmin();
  const client = getSupabaseAdmin();
  const query = parseOrderQuery(params);
  let request = client.from("ecommerce_orders").select(ORDER_SUMMARY_SELECT, { count: "exact" });
  if (query.status) request = request.eq("order_status", query.status);
  if (query.search) {
    const term = `%${query.search}%`;
    const phone = query.search.replace(/\D/g, "");
    request = request.or(`order_number.ilike.${term},customer_name.ilike.${term},customer_email.ilike.${term},customer_phone.ilike.%${phone || query.search}%`);
  }
  const { data, error, count } = await request.order("created_at", { ascending: false }).order("id", { ascending: false }).range(query.from, query.to);
  if (error) orderReadFailure("list", error);
  const counts = await Promise.all(["paid", "preparing", "ready_for_pickup", "shipped"].map(async (status) => {
    const result = await client.from("ecommerce_orders").select("id", { count: "exact", head: true })
      .eq("order_status", status).eq("payment_status", "paid");
    if (result.error) orderReadFailure("summary", result.error);
    return result.count ?? 0;
  }));
  return { orders: (data ?? []) as OrderSummary[], count: count ?? 0, query, counts, pageSize: ORDERS_PAGE_SIZE };
}

export async function getAdminOrder(id: string): Promise<OrderSnapshot | null> {
  await requireActiveAdmin();
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data, error } = await getSupabaseAdmin().from("ecommerce_orders")
    .select(`${ORDER_SNAPSHOT_SELECT},customer_cpf,ecommerce_payment_attempts(id,provider,order_nsu,provider_checkout_id,transaction_nsu,status,requested_amount_cents,paid_amount_cents,capture_method,installments,confirmed_at,created_at,failure_code)`)
    .eq("id", id).maybeSingle();
  if (error) orderReadFailure("detail", error);
  return data as unknown as OrderSnapshot | null;
}

export async function changeAdminOrderStatus(id: string, status: OrderStatus, expectedStatus: string) {
  await requireActiveAdmin();
  if (!z.string().uuid().safeParse(id).success) return "invalid";
  const client = getSupabaseAdmin();
  const current = await client.from("ecommerce_orders").select("payment_status,delivery_method,order_status")
    .eq("id", id).maybeSingle();
  if (current.error || !current.data) return "failed";
  if (current.data.order_status !== expectedStatus) return "conflict";
  if (!canSetOrderStatus(current.data, status) || !canUseOperationalStatus(current.data, status)) return "invalid";
  const result = await client.from("ecommerce_orders").update({ order_status: status })
    .eq("id", id).eq("order_status", expectedStatus).eq("payment_status", current.data.payment_status).select("id").maybeSingle();
  if (result.error) return "failed";
  return result.data ? "saved" : "conflict";
}
