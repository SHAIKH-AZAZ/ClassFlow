import { NextResponse } from "next/server";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const lectureId = url.searchParams.get("lectureId");

  let query = supabase
    .from("recordings")
    .select(
      "id, lecture_id, zoom_meeting_id, drive_file_id, view_url, download_url, duration_seconds, file_size_bytes, created_at, lectures(title, starts_at, group_id, faculty_id, groups(name, code))"
    )
    .order("created_at", { ascending: false });

  if (lectureId) query = query.eq("lecture_id", lectureId);

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyProfileId) return NextResponse.json({ recordings: [] });
    const { data: ownLectures } = await supabase
      .from("lectures")
      .select("id")
      .eq("faculty_id", facultyProfileId);
    const lectureIds = (ownLectures ?? []).map((l) => l.id);
    if (lectureIds.length === 0) return NextResponse.json({ recordings: [] });
    query = query.in("lecture_id", lectureIds);
  } else if (auth.profile.role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return NextResponse.json({ recordings: [] });
    const { data: groupRows } = await supabase.from("group_students").select("group_id").eq("student_id", student.id);
    const groupIds = (groupRows ?? []).map((r) => r.group_id);
    if (groupIds.length === 0) return NextResponse.json({ recordings: [] });
    const { data: lectureRows } = await supabase.from("lectures").select("id").in("group_id", groupIds);
    const lectureIds = (lectureRows ?? []).map((l) => l.id);
    if (lectureIds.length === 0) return NextResponse.json({ recordings: [] });
    query = query.in("lecture_id", lectureIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const recordings = (data ?? []).map((row: any) => {
    const lecture = Array.isArray(row.lectures) ? row.lectures[0] : row.lectures;
    const group = lecture?.groups ? (Array.isArray(lecture.groups) ? lecture.groups[0] : lecture.groups) : null;
    return {
      id: row.id,
      lectureId: row.lecture_id,
      lectureTitle: lecture?.title ?? null,
      lectureStartsAt: lecture?.starts_at ?? null,
      groupName: group?.name ?? null,
      groupCode: group?.code ?? null,
      driveFileId: row.drive_file_id,
      viewUrl: row.view_url,
      downloadUrl: row.download_url,
      durationSeconds: row.duration_seconds,
      sizeBytes: row.file_size_bytes,
      createdAt: row.created_at
    };
  });

  return NextResponse.json({ recordings });
}
