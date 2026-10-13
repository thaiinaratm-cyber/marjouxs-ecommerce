import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { classifyAdminAccess, type AdminAccess } from "@/lib/admin/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function resolveAdminAccess(supabase: SupabaseClient): Promise<AdminAccess> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (claimsError || !userId) {
    return classifyAdminAccess({ userId, authFailed: Boolean(claimsError) });
  }

  const { data: admin, error: adminError } = await supabase
    .from("ecommerce_admin_users")
    .select("is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return classifyAdminAccess({
    userId,
    adminCheckFailed: Boolean(adminError),
    isActiveAdmin: admin?.is_active === true
  });
}

export async function requireActiveAdmin() {
  const supabase = await createSupabaseServerClient();
  const access = await resolveAdminAccess(supabase);

  if (access.status !== "authorized" || !access.userId) {
    const error = access.status === "verification_error" ? "verification" : "access_denied";
    redirect(`/admin/login?error=${error}`);
  }

  return { supabase, userId: access.userId };
}
