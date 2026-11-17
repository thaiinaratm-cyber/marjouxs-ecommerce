import "server-only";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { recoveryStatuses, savedRecoveryItemSchema, type RecoveryStatus, type stageLabels } from "@/lib/recovery/model";

const source = "ecommerce_checkout_recovery_admin";
const columns = "id,last_activity_at,customer_name,phone_last4,subtotal_cents,item_count,stage,status,order_id,order_number";
const pageSize = 20;
type Summary = {
  id: string; last_activity_at: string; customer_name: string | null; phone_last4: string | null;
  subtotal_cents: number; item_count: number; stage: keyof typeof stageLabels; status: RecoveryStatus;
  order_id: string | null; order_number: string | null;
};
type Detail = Summary & {
  customer_phone: string | null; expires_at: string; delivery_method: "pickup" | "shipping";
  contact_allowed: boolean; cart_items: z.infer<typeof savedRecoveryItemSchema>[];
};

export async function listRecoveries(params: Record<string, string | string[] | undefined>) {
  await requireActiveAdmin();
  const status = z.enum(recoveryStatuses).safeParse(params.status).data;
  const start = z.iso.date().safeParse(params.from).data;
  const minimum = typeof params.min === "string" && /^\d{1,8}$/.test(params.min) ? params.min : "";
  const page = typeof params.page === "string" && /^[1-9]\d{0,3}$/.test(params.page) ? Number(params.page) : 1;
  let query = getSupabaseAdmin().from(source).select(columns, { count: "exact" });
  if (status) query = query.eq("status", status);
  if (start) query = query.gte("last_activity_at", `${start}T00:00:00-03:00`);
  if (minimum) query = query.gte("subtotal_cents", Number(minimum) * 100);
  const { data, count, error } = await query.order("last_activity_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return null;
  return { rows: (data ?? []) as unknown as Summary[], page, pageSize, count: count ?? 0, status, start, minimum };
}

export async function readRecovery(id: string): Promise<Detail | null | undefined> {
  await requireActiveAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await getSupabaseAdmin().from(source)
    .select(`${columns},customer_phone,expires_at,delivery_method,contact_allowed,cart_items`).eq("id", id).maybeSingle();
  if (error) return undefined;
  if (!data) return null;
  return { ...data, cart_items: z.array(savedRecoveryItemSchema).safeParse(data.cart_items).data ?? [] } as unknown as Detail;
}

export async function ignoreRecovery(id: string) {
  const recovery = await readRecovery(id);
  if (!recovery || !["active", "abandoned"].includes(recovery.status)) return false;
  const { error } = await getSupabaseAdmin().from("ecommerce_checkout_recovery")
    .update({ ignored_at: new Date().toISOString() }).eq("id", id).is("ignored_at", null);
  return !error;
}
