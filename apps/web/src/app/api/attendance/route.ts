import { NextResponse } from "next/server";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const lectureId = url.searchParams.get("lectureId");
  const studentId = url.searchParams.get("studentId");

  let query = supabase
    .from("attendance")
    .select(
      "id, lecture_id, student_id, duration_minutes, required_minutes, status, source, calculated_at, student_profiles(id, roll_number, profiles(full_name, email)), lectures(title, starts_at, ends_at, faculty_id, groups(name, code))"
    )
    .order("calculated_at", { ascending: false });

  if (lectureId) query = query.eq("lecture_id", lectureId);

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyProfileId) return NextResponse.json({ rows: [] });
    if (lectureId) {
      const { data: lecture } = await supabase
        .from("lectures")
        .select("faculty_id")
        .eq("id", lectureId)
        .maybeSingle();
      if (lecture?.faculty_id !== facultyProfileId) {
        return NextResponse.json({ error: "Faculty can only see their own lectures." }, { status: 403 });
      }
    }
  } else if (auth.profile.role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return NextResponse.json({ rows: [] });
    query = query.eq("student_id", student.id);
  } else if (studentId && auth.profile.role === "admin") {
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => {
    const sp = Array.isArray(row.student_profiles) ? row.student_profiles[0] : row.student_profiles;
    const sProfile = sp?.profiles ? (Array.isArray(sp.profiles) ? sp.profiles[0] : sp.profiles) : null;
    const lecture = Array.isArray(row.lectures) ? row.lectures[0] : row.lectures;
    const group = lecture?.groups ? (Array.isArray(lecture.groups) ? lecture.groups[0] : lecture.groups) : null;
    return {
      id: row.id,
      lectureId: row.lecture_id,
      studentId: row.student_id,
      durationMinutes: Number(row.duration_minutes),
      requiredMinutes: Number(row.required_minutes),
      status: row.status,
      source: row.source,
      calculatedAt: row.calculated_at,
      studentName: sProfile?.full_name ?? null,
      studentEmail: sProfile?.email ?? null,
      rollNumber: sp?.roll_number ?? null,
      lectureTitle: lecture?.title ?? null,
      lectureStartsAt: lecture?.starts_at ?? null,
      lectureEndsAt: lecture?.ends_at ?? null,
      groupName: group?.name ?? null,
      groupCode: group?.code ?? null
    };
  });

  return NextResponse.json({ rows });
}
