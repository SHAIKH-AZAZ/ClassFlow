import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: notice } = await supabase
    .from("notices")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();
  if (!notice) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (auth.profile.role !== "admin" && notice.created_by !== auth.profile.id) {
    return NextResponse.json({ error: "Only the author or admin can delete." }, { status: 403 });
  }

  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
