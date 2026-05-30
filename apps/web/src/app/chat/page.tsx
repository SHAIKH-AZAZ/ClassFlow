import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const { user, profile } = await requirePageRole(["admin", "faculty", "student"], "/chat");
  const admin = getSupabaseAdmin();

  // For students, only show groups they're enrolled in. For everyone else,
  // show all active groups.
  let groupsList: { id: string; name: string; code: string }[] = [];
  if (profile.role === "student") {
    const { data: studentRow } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (studentRow) {
      const { data: rows } = await admin
        .from("group_students")
        .select("groups(id, name, code)")
        .eq("student_id", studentRow.id);
      for (const row of (rows ?? []) as any[]) {
        const g = Array.isArray(row.groups) ? row.groups[0] : row.groups;
        if (g) groupsList.push({ id: g.id, name: g.name, code: g.code });
      }
    }
  } else {
    const { data: rows } = await admin
      .from("groups")
      .select("id, name, code")
      .eq("active", true)
      .order("name");
    groupsList = (rows ?? []).map((g: any) => ({ id: g.id, name: g.name, code: g.code }));
  }

  // Directory of other users available for direct messages.
  const { data: directories } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .eq("active", true)
    .neq("id", user.id)
    .order("full_name");

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Communication</p>
          <h1>Chat</h1>
          <p className="muted">Group conversations and direct messages. Polled every few seconds.</p>
        </div>
      </div>
      <ChatClient
        currentUserId={profile.id}
        role={profile.role}
        groups={groupsList}
        directory={(directories ?? []).map((p: any) => ({ id: p.id, fullName: p.full_name, role: p.role }))}
      />
    </AppShell>
  );
}
