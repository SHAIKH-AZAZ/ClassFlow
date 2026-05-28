import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { StudentClient } from "./student-client";

export default async function StudentPage() {
  const { user } = await requirePageRole(["admin", "student"], "/student");
  const supabase = await getSupabaseServerClient();

  const { data: student } = await supabase
    .from("student_profiles")
    .select("id, roll_number")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: enrollments } = student
    ? await supabase.from("group_students").select("groups(id, name, code)").eq("student_id", student.id)
    : { data: [] };

  const groupRows = (enrollments ?? []).map((row: any) => {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    return { id: group?.id ?? "", name: group?.name ?? "Unknown", code: group?.code ?? "" };
  });

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Student workspace</p>
          <h1>Schedule, recordings, resources</h1>
          <p className="muted">Only data for your enrolled groups is shown.</p>
        </div>
        <span className="badge">{student?.roll_number ?? "No student profile"}</span>
      </div>

      {groupRows.length > 0 ? (
        <article className="card" style={{ marginBottom: 16 }}>
          <h2>My groups</h2>
          <div className="actions">
            {groupRows.map((g) => (
              <span key={g.id} className="chip">
                {g.name} · {g.code}
              </span>
            ))}
          </div>
        </article>
      ) : (
        <article className="card" style={{ marginBottom: 16 }}>
          <p className="empty">You are not enrolled in any group yet. Contact admin.</p>
        </article>
      )}

      <StudentClient />
    </AppShell>
  );
}
