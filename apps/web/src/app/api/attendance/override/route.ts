import { NextResponse } from "next/server";
import type { AttendanceStatus } from "@zoom-lms/shared";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type OverrideBody = {
  attendanceId: string;
  status: AttendanceStatus;
  reason: string;
};

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as OverrideBody;
  if (!body.attendanceId || !body.status || !body.reason) {
    return NextResponse.json({ error: "attendanceId, status, reason are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error: rowError } = await supabase
    .from("attendance")
    .select("id, lecture_id, lectures(faculty_id)")
    .eq("id", body.attendanceId)
    .maybeSingle();
  if (rowError || !row) return NextResponse.json({ error: "Attendance row not found." }, { status: 404 });

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    const lecture = Array.isArray(row.lectures) ? row.lectures[0] : row.lectures;
    if (!facultyProfileId || lecture?.faculty_id !== facultyProfileId) {
      return NextResponse.json({ error: "Faculty can only override their own lecture attendance." }, { status: 403 });
    }
  }

  const { error: insertError } = await supabase.from("attendance_overrides").insert({
    attendance_id: body.attendanceId,
    status: body.status,
    reason: body.reason,
    corrected_by: auth.profile.id
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { error: updateError } = await supabase
    .from("attendance")
    .update({ status: body.status, source: "override" })
    .eq("id", body.attendanceId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase.from("system_logs").insert({
    actor_id: auth.profile.id,
    action: "attendance.override",
    entity_type: "attendance",
    entity_id: body.attendanceId,
    metadata: { status: body.status, reason: body.reason }
  });

  return NextResponse.json({ ok: true });
}
