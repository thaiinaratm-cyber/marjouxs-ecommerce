import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/checkout/supabase";
import { MAX_MANUAL_RELATIONS } from "@/lib/product-recommendations";
import { normalizeText } from "@/lib/format";

export type RelationOption = { id: string; name: string; slug: string; available: boolean };
const fields = "id,name,slug,is_active,stock_status";
const allowedStatuses = ["available", "made_to_order"];
const idList = z.array(z.uuid().transform(value => value.toLowerCase())).max(MAX_MANUAL_RELATIONS)
  .refine(ids => new Set(ids).size === ids.length);

export function parseRelationIds(values: FormDataEntryValue[], exclude?: string) {
  const parsed = idList.safeParse(values);
  return parsed.success && !parsed.data.includes(exclude?.toLowerCase() ?? "") ? parsed.data : null;
}

function project(row: { id: string; name: string; slug: string; is_active: boolean; stock_status: string }): RelationOption {
  return { id: row.id, name: row.name, slug: row.slug, available: row.is_active && allowedStatuses.includes(row.stock_status) };
}

export async function searchRelationTargets(supabase: SupabaseClient, input: string, exclude?: string) {
  const search = input.trim().replace(/[^A-Za-z\u00C0-\u024F0-9 -]/g, "").slice(0, 80).trim();
  if (search.length < 2) return [];
  const slug = normalizeText(search).replace(/\s+/g, "-");
  let query = supabase.from("ecommerce_products").select(fields)
    .eq("is_active", true).in("stock_status", allowedStatuses)
    .or(`name.ilike.%${search}%,slug.ilike.%${slug}%`);
  if (exclude) query = query.neq("id", exclude);
  const { data, error } = await query.order("name").order("id").limit(12);
  return error ? null : (data ?? []).map(project);
}

export async function getAdminProductRelations(supabase: SupabaseClient, id: string) {
  try {
    const { data, error } = await getSupabaseAdmin().from("ecommerce_product_relations")
      .select("related_product_id").eq("product_id", id).order("position");
    if (error) return null;
    const ids = (data ?? []).map(row => row.related_product_id as string);
    if (!ids.length) return [];
    const targets = await supabase.from("ecommerce_products").select(fields).in("id", ids);
    if (targets.error) return null;
    const options = new Map((targets.data ?? []).map(row => [row.id, project(row)]));
    return ids.map(id => options.get(id) ?? { id, name: "Produto indispon\u00edvel", slug: "", available: false });
  } catch { return null; }
}

export async function validRelationTargets(supabase: SupabaseClient, ids: string[]) {
  const { data, error } = await supabase.from("ecommerce_products").select("id").in("id", ids)
    .eq("is_active", true).in("stock_status", allowedStatuses);
  return !error && data?.length === ids.length;
}

export async function setProductRelations(id: string, version: number, expected: string[], related: string[]) {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("ecommerce_set_product_relations", {
      p_id: id, p_version: version, p_expected: expected, p_related: related
    });
    if (!error && (data === "saved" || data === "conflict" || data === "invalid")) return data;
  } catch { /* Reuse the admin's generic save error. */ }
  return "failed";
}
