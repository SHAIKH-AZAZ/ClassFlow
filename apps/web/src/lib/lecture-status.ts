import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mark any lecture whose `ends_at` is already in the past and which is still
 * `scheduled` or `live` as `completed`. Idempotent. Safe to call from any
 * read endpoint to keep statuses fresh without depending on Zoom webhooks.
 */
export async function autoCompleteOverdueLectures(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("lectures")
    .update({ status: "completed", updated_at: now })
    .lt("ends_at", now)
    .in("status", ["scheduled", "live"]);
  if (error) {
    // Don't block the read on a sweep failure — just log it for visibility.
    console.warn("autoCompleteOverdueLectures failed:", error.message);
  }
}
