import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AddBody = { studentId: string };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("group_students")
    .select("student_id, created_at, student_profiles(id, roll_number, profiles(id, email, full_name))")
    .eq("group_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollments: data });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = (await request.json()) as AddBody;
  if (!body.studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("group_students").upsert(
    { group_id: id, student_id: body.studentId },
    { onConflict: "group_id,student_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("group_students").delete().eq("group_id", id).eq("student_id", studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
