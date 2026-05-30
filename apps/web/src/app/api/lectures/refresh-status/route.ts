import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { autoCompleteOverdueLectures } from "@/lib/lecture-status";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Lightweight admin/faculty endpoint to force a lecture-status sweep without
// waiting for the next list call.
export async function POST() {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  await autoCompleteOverdueLectures(supabase);
  return NextResponse.json({ ok: true });
}
