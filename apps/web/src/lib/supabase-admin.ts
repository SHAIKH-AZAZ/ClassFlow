import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!client) {
    client = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return client;
}
