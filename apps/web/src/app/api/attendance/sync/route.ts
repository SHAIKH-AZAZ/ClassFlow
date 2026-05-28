import { NextResponse } from "next/server";
import { calculateAttendanceStatus, minutesBetween } from "@/lib/attendance";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listZoomParticipants } from "@/lib/zoom";

type AttendanceSyncInput = {
  lectureId: string;
};

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const { lectureId } = (await request.json()) as AttendanceSyncInput;
  const supabase = getSupabaseAdmin();

  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .select("id, group_id, faculty_id, starts_at, ends_at, attendance_threshold_percent, zoom_meetings(zoom_meeting_id)")
    .eq("id", lectureId)
    .single();

  if (lectureError || !lecture) {
    return NextResponse.json({ error: lectureError?.message ?? "Lecture not found." }, { status: 404 });
  }

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyProfileId || facultyProfileId !== lecture.faculty_id) {
      return NextResponse.json({ error: "Faculty can only sync attendance for their own lectures." }, { status: 403 });
    }
  }

  const zoomMeeting = Array.isArray(lecture.zoom_meetings) ? lecture.zoom_meetings[0] : lecture.zoom_meetings;
  if (!zoomMeeting?.zoom_meeting_id) {
    return NextResponse.json({ error: "Zoom meeting not found for lecture." }, { status: 404 });
  }

  const { data: groupStudents, error: studentsError } = await supabase
    .from("group_students")
    .select("student_id, student_profiles(id, user_id, profiles(email, full_name))")
    .eq("group_id", lecture.group_id);

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const report = await listZoomParticipants(zoomMeeting.zoom_meeting_id);
  const durationByEmail = new Map<string, number>();

  for (const participant of report.participants ?? []) {
    if (!participant.user_email) continue;
    const email = participant.user_email.toLowerCase();
    durationByEmail.set(email, (durationByEmail.get(email) ?? 0) + Math.round(participant.duration / 60));
  }

  const lectureMinutes = minutesBetween(lecture.starts_at, lecture.ends_at);
  const requiredMinutes = lectureMinutes * (Number(lecture.attendance_threshold_percent) / 100);
  const rows = (groupStudents ?? []).map((row: any) => {
    const email = row.student_profiles?.profiles?.email?.toLowerCase();
    const durationMinutes = email ? durationByEmail.get(email) ?? 0 : 0;
    return {
      lecture_id: lecture.id,
      student_id: row.student_id,
      duration_minutes: durationMinutes,
      required_minutes: requiredMinutes,
      status: calculateAttendanceStatus(durationMinutes, lectureMinutes, Number(lecture.attendance_threshold_percent)),
      source: "zoom"
    };
  });

  const { error: upsertError } = await supabase.from("attendance").upsert(rows, {
    onConflict: "lecture_id,student_id"
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ synced: rows.length });
}
