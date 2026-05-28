import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getDriveClient } from "@/lib/google-drive";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data: resource, error: fetchError } = await supabase
    .from("resources")
    .select("id, owner_id, drive_file_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

  if (auth.profile.role === "faculty" && resource.owner_id !== auth.profile.id) {
    return NextResponse.json({ error: "Only the owning faculty or admin may delete." }, { status: 403 });
  }

  if (resource.drive_file_id) {
    try {
      await getDriveClient().files.delete({ fileId: resource.drive_file_id });
    } catch (error) {
      // Drive deletion failure should not block DB cleanup but log it.
      await supabase.from("system_logs").insert({
        actor_id: auth.profile.id,
        action: "resource.drive_delete_failed",
        entity_type: "resources",
        entity_id: id,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
