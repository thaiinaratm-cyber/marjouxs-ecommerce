"use server";

import { redirect } from "next/navigation";
import { requireActiveAdmin } from "@/lib/admin/auth";

export async function logoutAction() {
  const { supabase } = await requireActiveAdmin();
  await supabase.auth.signOut();
  redirect("/admin/login?logged_out=1");
}
