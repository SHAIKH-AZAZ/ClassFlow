import { NextResponse } from "next/server";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { minutesBetween } from "@/lib/attendance";

type SeedBody = { lectureId: string };

// Insert attendance rows for every student in the lecture's group, defaulting
// to "absent". Faculty/admin can then override individual rows by hand. Used
// when Zoom's report API isn't available (e.g. Basic accounts).
export async function POST(request: Request) {
  try {
    const auth = await requireApiRole(["admin", "faculty"]);
    if (auth.error) return auth.error;

    const { lectureId } = (await request.json()) as SeedBody;
    if (!lectureId) {
      return NextResponse.json({ error: "lectureId required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: lecture, error: lectureError } = await supabase
      .from("lectures")
      .select("id, group_id, faculty_id, starts_at, ends_at, attendance_threshold_percent")
      .eq("id", lectureId)
      .single();

    if (lectureError || !lecture) {
      return NextResponse.json({ error: lectureError?.message ?? "Lecture not found." }, { status: 404 });
    }

    if (auth.profile.role === "faculty") {
      const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
      if (!facultyProfileId || facultyProfileId !== lecture.faculty_id) {
        return NextResponse.json(
          { error: "Faculty can only seed attendance for their own lectures." },
          { status: 403 }
        );
      }
    }

    const { data: groupStudents, error: studentsError } = await supabase
      .from("group_students")
      .select("student_id")
      .eq("group_id", lecture.group_id);
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    const lectureMinutes = minutesBetween(lecture.starts_at, lecture.ends_at);
    const requiredMinutes = lectureMinutes * (Number(lecture.attendance_threshold_percent) / 100);

    const rows = (groupStudents ?? []).map((row) => ({
      lecture_id: lecture.id,
      student_id: row.student_id,
      duration_minutes: 0,
      required_minutes: requiredMinutes,
      status: "absent",
      source: "manual"
    }));

    if (rows.length === 0) {
      return NextResponse.json({ seeded: 0, notice: "No students enrolled in this group." });
    }

    // ignoreDuplicates: only insert rows that don't yet exist; existing rows
    // are left alone so faculty don't lose previous overrides.
    const { error: upsertError, count } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "lecture_id,student_id", ignoreDuplicates: true, count: "exact" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ seeded: count ?? rows.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error seeding attendance." },
      { status: 500 }
    );
  }
}
