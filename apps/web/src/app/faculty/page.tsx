import { AppShell } from "@/components/app-shell";
import { getFacultyProfileIdForUser, requirePageRole } from "@/lib/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { FacultyClient } from "./faculty-client";

export default async function FacultyPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const { user, profile } = await requirePageRole(["admin", "faculty"], "/faculty");
  const supabase = await getSupabaseServerClient();

  const facultyProfileId = profile.role === "faculty" ? await getFacultyProfileIdForUser(user.id) : null;

  const params = await searchParams;
  const tab = (Array.isArray(params?.tab) ? params.tab[0] : params?.tab) ?? "lectures";

  const [{ data: groups }, { data: faculties }] = await Promise.all([
    supabase.from("groups").select("id, name, code").eq("active", true).order("name"),
    supabase.from("faculty_profiles").select("id, zoom_host_user_id, profiles(full_name)").order("created_at")
  ]);

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Faculty workspace</p>
          <h1>Lectures, recordings, attendance</h1>
          <p className="muted">Schedule classes, capture local recordings, and review attendance.</p>
        </div>
        <span className="badge live">Zoom ready</span>
      </div>

      <FacultyClient
        initialTab={tab as string}
        role={profile.role as "admin" | "faculty"}
        facultyProfileId={facultyProfileId}
        groups={(groups ?? []).map((g: any) => ({ id: g.id, name: g.name, code: g.code }))}
        faculties={(faculties ?? []).map((f: any) => {
          const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
          return { id: f.id, fullName: p?.full_name ?? "Faculty", zoomHostUserId: f.zoom_host_user_id };
        })}
      />
    </AppShell>
  );
}
