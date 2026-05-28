import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SendBody = { body: string };

async function ensureMembership(threadId: string, profileId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("chat_thread_members")
    .select("thread_id")
    .eq("thread_id", threadId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!(await ensureMembership(id, auth.profile.id)) && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Not a member of this thread." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  let query = supabase
    .from("chat_messages")
    .select("id, thread_id, sender_id, body, created_at, profiles(full_name, role)")
    .eq("thread_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (after) query = query.gt("created_at", after);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = (data ?? []).map((row: any) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      threadId: row.thread_id,
      senderId: row.sender_id,
      senderName: author?.full_name ?? null,
      senderRole: author?.role ?? null,
      body: row.body,
      createdAt: row.created_at
    };
  });

  return NextResponse.json({ messages });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!(await ensureMembership(id, auth.profile.id))) {
    return NextResponse.json({ error: "Not a member of this thread." }, { status: 403 });
  }

  const body = (await request.json()) as SendBody;
  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: "Message body required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ thread_id: id, sender_id: auth.profile.id, body: body.body.trim() })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}
