"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { resolveAdminAccess } from "@/lib/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200)
});

export async function loginAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) redirect("/admin/login?error=invalid_credentials");

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect("/admin/login?error=configuration");
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/admin/login?error=invalid_credentials");

  const access = await resolveAdminAccess(supabase);
  if (access.status !== "authorized") {
    await supabase.auth.signOut();
    const code = access.status === "verification_error" ? "verification" : "access_denied";
    redirect(`/admin/login?error=${code}`);
  }

  redirect("/admin/produtos");
}
