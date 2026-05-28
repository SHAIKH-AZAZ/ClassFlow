import { NextResponse } from "next/server";
import type { LectureStatus } from "@zoom-lms/shared";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UpdateBody = {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: LectureStatus;
  attendanceThresholdPercent?: number;
};

async function ensureFacultyOwnsLecture(userId: string, lectureId: string) {
  const supabase = getSupabaseAdmin();
  const facultyProfileId = await getFacultyProfileIdForUser(userId);
  if (!facultyProfileId) return false;
  const { data } = await supabase.from("lectures").select("faculty_id").eq("id", lectureId).maybeSingle();
  return data?.faculty_id === facultyProfileId;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = (await request.json()) as UpdateBody;

  if (auth.profile.role === "faculty" && !(await ensureFacultyOwnsLecture(auth.user.id, id))) {
    return NextResponse.json({ error: "Faculty can only modify their own lectures." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.startsAt !== undefined) updates.starts_at = body.startsAt;
  if (body.endsAt !== undefined) updates.ends_at = body.endsAt;
  if (body.status !== undefined) updates.status = body.status;
  if (body.attendanceThresholdPercent !== undefined) updates.attendance_threshold_percent = body.attendanceThresholdPercent;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("lectures").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lecture: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (auth.profile.role === "faculty" && !(await ensureFacultyOwnsLecture(auth.user.id, id))) {
    return NextResponse.json({ error: "Faculty can only delete their own lectures." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("lectures").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
