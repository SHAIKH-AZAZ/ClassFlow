import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NoticesClient } from "./notices-client";

export default async function NoticesPage() {
  const { profile } = await requirePageRole(["admin", "faculty", "student"], "/notices");
  const admin = getSupabaseAdmin();

  const { data: groups } =
    profile.role === "student"
      ? { data: [] as { id: string; name: string; code: string }[] }
      : await admin.from("groups").select("id, name, code").eq("active", true).order("name");

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Communication</p>
          <h1>Notices</h1>
          <p className="muted">Group-scoped or institute-wide announcements.</p>
        </div>
      </div>
      <NoticesClient role={profile.role} groups={groups ?? []} />
    </AppShell>
  );
}
