import { NextResponse } from "next/server";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreateBody = {
  studentId: string;
  lectureId?: string | null;
  body: string;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");

  let query = supabase
    .from("remarks")
    .select(
      "id, student_id, faculty_id, lecture_id, body, created_at, faculty_profiles(profiles(full_name)), student_profiles(roll_number, profiles(full_name)), lectures(title)"
    )
    .order("created_at", { ascending: false });

  if (studentId) query = query.eq("student_id", studentId);

  if (auth.profile.role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return NextResponse.json({ remarks: [] });
    query = query.eq("student_id", student.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const remarks = (data ?? []).map((row: any) => {
    const fp = Array.isArray(row.faculty_profiles) ? row.faculty_profiles[0] : row.faculty_profiles;
    const fProfile = fp?.profiles ? (Array.isArray(fp.profiles) ? fp.profiles[0] : fp.profiles) : null;
    const sp = Array.isArray(row.student_profiles) ? row.student_profiles[0] : row.student_profiles;
    const sProfile = sp?.profiles ? (Array.isArray(sp.profiles) ? sp.profiles[0] : sp.profiles) : null;
    const lecture = Array.isArray(row.lectures) ? row.lectures[0] : row.lectures;
    return {
      id: row.id,
      studentId: row.student_id,
      facultyId: row.faculty_id,
      lectureId: row.lecture_id,
      body: row.body,
      createdAt: row.created_at,
      facultyName: fProfile?.full_name ?? null,
      studentName: sProfile?.full_name ?? null,
      rollNumber: sp?.roll_number ?? null,
      lectureTitle: lecture?.title ?? null
    };
  });

  return NextResponse.json({ remarks });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as CreateBody;
  if (!body.studentId || !body.body) {
    return NextResponse.json({ error: "studentId and body are required." }, { status: 400 });
  }

  let facultyId: string | null = null;
  if (auth.profile.role === "faculty") {
    facultyId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyId) return NextResponse.json({ error: "Faculty profile not found." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("remarks")
    .insert({
      student_id: body.studentId,
      faculty_id: facultyId,
      lecture_id: body.lectureId ?? null,
      body: body.body
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ remark: data });
}
