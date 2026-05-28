import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const { user, profile } = await requirePageRole(["admin", "faculty", "student"], "/chat");
  const supabase = await getSupabaseServerClient();

  const [{ data: groups }, { data: directories }] = await Promise.all([
    profile.role === "student"
      ? supabase
          .from("group_students")
          .select("group_id, groups(id, name, code)")
          .eq("student_id", (
            await supabase.from("student_profiles").select("id").eq("user_id", user.id).maybeSingle()
          ).data?.id ?? "00000000-0000-0000-0000-000000000000")
      : supabase.from("groups").select("id, name, code").eq("active", true).order("name"),
    supabase.from("profiles").select("id, full_name, role").eq("active", true).neq("id", user.id).order("full_name")
  ]);

  const groupsList: { id: string; name: string; code: string }[] = [];
  for (const row of (groups ?? []) as any[]) {
    if (row.groups) {
      const g = Array.isArray(row.groups) ? row.groups[0] : row.groups;
      if (g) groupsList.push({ id: g.id, name: g.name, code: g.code });
    } else if (row.id) {
      groupsList.push({ id: row.id, name: row.name, code: row.code });
    }
  }

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
