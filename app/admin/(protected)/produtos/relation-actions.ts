"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { revalidateAdminProduct } from "@/lib/admin/revalidate";
import { parseRelationIds, searchRelationTargets, setProductRelations } from "@/lib/admin/product-relations";

export async function searchRelatedProductsAction(query: string, exclude?: string) {
  const { supabase } = await requireActiveAdmin();
  if (typeof query !== "string" || query.length > 120) return [];
  const id = z.uuid().safeParse(exclude).data;
  return searchRelationTargets(supabase, query, id);
}

export async function saveProductRelationsAction(form: FormData) {
  await requireActiveAdmin();
  const id = z.uuid().safeParse(form.get("productId")).data;
  if (!id) redirect("/admin/produtos");
  const version = z.string().regex(/^\d{1,15}$/).transform(Number).safeParse(form.get("version")).data;
  const related = parseRelationIds(form.getAll("relatedProductIds"), id);
  const expected = parseRelationIds(form.getAll("expectedRelatedIds"), id);
  const status = version !== undefined && related && expected
    ? await setProductRelations(id, version, expected, related) : "invalid";
  if (status === "saved") revalidateAdminProduct(id);
  redirect(`/admin/produtos/${id}?relacoes=${status}#produtos-relacionados`);
}
