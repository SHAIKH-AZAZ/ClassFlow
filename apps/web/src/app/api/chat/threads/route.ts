import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreateThreadBody = {
  type: "group" | "direct";
  groupId?: string | null;
  participantIds?: string[];
};

export async function GET() {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const { data: memberships, error: memError } = await supabase
    .from("chat_thread_members")
    .select("thread_id")
    .eq("profile_id", auth.profile.id);
  if (memError) return NextResponse.json({ error: memError.message }, { status: 500 });

  const threadIds = (memberships ?? []).map((m) => m.thread_id);
  if (threadIds.length === 0) return NextResponse.json({ threads: [] });

  const { data: threads, error } = await supabase
    .from("chat_threads")
    .select("id, type, group_id, created_by, created_at, groups(name, code), chat_thread_members(profile_id, profiles(id, full_name, role))")
    .in("id", threadIds)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (threads ?? []).map((row: any) => {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const members = (row.chat_thread_members ?? []).map((m: any) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return { id: m.profile_id, fullName: p?.full_name ?? null, role: p?.role ?? null };
    });
    let label = group?.name ?? "Direct";
    if (row.type === "direct") {
      const others = members.filter((m: any) => m.id !== auth.profile.id);
      label = others.map((m: any) => m.fullName ?? "Unknown").join(", ") || "Direct";
    }
    return {
      id: row.id,
      type: row.type,
      groupId: row.group_id,
      label,
      members,
      createdAt: row.created_at
    };
  });

  return NextResponse.json({ threads: result });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as CreateThreadBody;
  const supabase = getSupabaseAdmin();

  if (body.type === "group") {
    if (!body.groupId) return NextResponse.json({ error: "groupId required for group threads." }, { status: 400 });
    if (auth.profile.role === "student") {
      return NextResponse.json({ error: "Students cannot start group threads." }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("type", "group")
      .eq("group_id", body.groupId)
      .maybeSingle();
    if (existing) return NextResponse.json({ thread: existing });

    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ type: "group", group_id: body.groupId, created_by: auth.profile.id })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Add all current members of the group plus admins/faculty teaching the group.
    const { data: studentRows } = await supabase
      .from("group_students")
      .select("student_profiles(user_id)")
      .eq("group_id", body.groupId);
    const studentUserIds = (studentRows ?? [])
      .map((r: any) => (Array.isArray(r.student_profiles) ? r.student_profiles[0]?.user_id : r.student_profiles?.user_id))
      .filter(Boolean);

    const { data: facultyRows } = await supabase
      .from("lectures")
      .select("faculty_profiles(user_id)")
      .eq("group_id", body.groupId);
    const facultyUserIds = (facultyRows ?? [])
      .map((r: any) => (Array.isArray(r.faculty_profiles) ? r.faculty_profiles[0]?.user_id : r.faculty_profiles?.user_id))
      .filter(Boolean);

    const memberIds = Array.from(new Set([auth.profile.id, ...studentUserIds, ...facultyUserIds])) as string[];
    if (memberIds.length > 0) {
      await supabase
        .from("chat_thread_members")
        .upsert(memberIds.map((profileId) => ({ thread_id: thread.id, profile_id: profileId })), {
          onConflict: "thread_id,profile_id"
        });
    }

    return NextResponse.json({ thread });
  }

  if (body.type === "direct") {
    const otherId = (body.participantIds ?? []).find((id) => id !== auth.profile.id);
    if (!otherId) return NextResponse.json({ error: "participantIds must include another user id." }, { status: 400 });

    // Find existing direct thread between these two members.
    const { data: existingThreads } = await supabase
      .from("chat_threads")
      .select("id, chat_thread_members(profile_id)")
      .eq("type", "direct");

    const match = (existingThreads ?? []).find((t: any) => {
      const ids = (t.chat_thread_members ?? []).map((m: any) => m.profile_id).sort();
      const want = [auth.profile.id, otherId].sort();
      return ids.length === 2 && ids[0] === want[0] && ids[1] === want[1];
    });
    if (match) return NextResponse.json({ thread: { id: match.id, type: "direct" } });

    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ type: "direct", group_id: null, created_by: auth.profile.id })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { error: memberError } = await supabase.from("chat_thread_members").insert([
      { thread_id: thread.id, profile_id: auth.profile.id },
      { thread_id: thread.id, profile_id: otherId }
    ]);
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });

    return NextResponse.json({ thread });
  }

  return NextResponse.json({ error: "type must be group or direct." }, { status: 400 });
}
