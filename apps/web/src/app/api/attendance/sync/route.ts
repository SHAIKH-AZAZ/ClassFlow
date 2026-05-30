import { NextResponse } from "next/server";
import { calculateAttendanceStatus, minutesBetween } from "@/lib/attendance";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listZoomParticipants } from "@/lib/zoom";

type AttendanceSyncInput = {
  lectureId: string;
};

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: "Zoom meeting not found for this lecture." }, { status: 404 });
    }

    const { data: groupStudents, error: studentsError } = await supabase
      .from("group_students")
      .select("student_id, student_profiles(id, user_id, profiles(email, full_name))")
      .eq("group_id", lecture.group_id);

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    // Pull participants from Zoom. The report API returns 404/etc. when the
    // meeting has not started yet or no report is available — treat that as
    // zero attendance instead of a hard failure.
    let participants: Array<{ user_email?: string; name: string; duration: number }> = [];
    let zoomNotice: string | null = null;
    try {
      const report = await listZoomParticipants(zoomMeeting.zoom_meeting_id);
      participants = report.participants ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Zoom returns "Meeting does not exist" / 3001 / 404 when no report yet.
      const looksMissing = /\b(404|3001|not exist|no participants|Meeting has not started)\b/i.test(message);
      if (looksMissing) {
        zoomNotice = "Zoom has no participant report for this meeting yet. Marking attendees as absent.";
      } else {
        return NextResponse.json({ error: `Zoom report failed: ${message}` }, { status: 502 });
      }
    }

    const durationByEmail = new Map<string, number>();
    for (const participant of participants) {
      if (!participant.user_email) continue;
      const email = participant.user_email.toLowerCase();
      durationByEmail.set(email, (durationByEmail.get(email) ?? 0) + Math.round(participant.duration / 60));
    }

    const lectureMinutes = minutesBetween(lecture.starts_at, lecture.ends_at);
    const requiredMinutes = lectureMinutes * (Number(lecture.attendance_threshold_percent) / 100);
    const rows = (groupStudents ?? []).map((row: any) => {
      const sp = Array.isArray(row.student_profiles) ? row.student_profiles[0] : row.student_profiles;
      const profile = sp?.profiles ? (Array.isArray(sp.profiles) ? sp.profiles[0] : sp.profiles) : null;
      const email = profile?.email?.toLowerCase();
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

    if (rows.length === 0) {
      return NextResponse.json({
        synced: 0,
        notice: "No students are enrolled in this group yet."
      });
    }

    const { error: upsertError } = await supabase.from("attendance").upsert(rows, {
      onConflict: "lecture_id,student_id"
    });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ synced: rows.length, notice: zoomNotice });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error syncing attendance." },
      { status: 500 }
    );
  }
}
