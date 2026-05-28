import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreateNoticeBody = {
  groupId?: string | null;
  title: string;
  body: string;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");

  let query = supabase
    .from("notices")
    .select("id, group_id, title, body, created_by, created_at, profiles(full_name), groups(name, code)")
    .order("created_at", { ascending: false });

  if (groupId === "global") {
    query = query.is("group_id", null);
  } else if (groupId) {
    query = query.eq("group_id", groupId);
  }

  if (auth.profile.role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (student) {
      const { data: groupRows } = await supabase.from("group_students").select("group_id").eq("student_id", student.id);
      const groupIds = (groupRows ?? []).map((r) => r.group_id);
      query = query.or(`group_id.is.null,group_id.in.(${groupIds.length ? groupIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
    } else {
      query = query.is("group_id", null);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notices = (data ?? []).map((row: any) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    return {
      id: row.id,
      groupId: row.group_id,
      title: row.title,
      body: row.body,
      authorName: author?.full_name ?? null,
      groupName: group?.name ?? null,
      groupCode: group?.code ?? null,
      createdAt: row.created_at
    };
  });

  return NextResponse.json({ notices });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as CreateNoticeBody;
  if (!body.title || !body.body) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("notices")
    .insert({
      group_id: body.groupId ?? null,
      title: body.title,
      body: body.body,
      created_by: auth.profile.id
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notice: data });
}
