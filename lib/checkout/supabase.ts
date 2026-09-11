import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfiguration } from "@/lib/checkout/config";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  const { url, serviceRoleKey } = getSupabaseConfiguration();
  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}
