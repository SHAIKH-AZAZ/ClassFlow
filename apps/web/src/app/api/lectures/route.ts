import { NextResponse } from "next/server";
import type { CreateLectureInput } from "@zoom-lms/shared";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createZoomMeeting } from "@/lib/zoom";
import { optionalNumberEnv } from "@/lib/env";
import { minutesBetween } from "@/lib/attendance";
import { autoCompleteOverdueLectures } from "@/lib/lecture-status";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  await autoCompleteOverdueLectures(supabase);
  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");
  const facultyId = url.searchParams.get("facultyId");
  const upcoming = url.searchParams.get("upcoming");

  let query = supabase
    .from("lectures")
    .select(
      "id, title, description, group_id, faculty_id, starts_at, ends_at, status, attendance_threshold_percent, groups(name, code), faculty_profiles(id, profiles(full_name)), zoom_meetings(zoom_meeting_id, join_url, start_url, password)"
    )
    .order("starts_at", { ascending: false });

  if (groupId) query = query.eq("group_id", groupId);
  if (facultyId) query = query.eq("faculty_id", facultyId);
  if (upcoming === "true") query = query.gte("ends_at", new Date().toISOString());

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyProfileId) return NextResponse.json({ lectures: [] });
    query = query.eq("faculty_id", facultyProfileId);
  } else if (auth.profile.role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return NextResponse.json({ lectures: [] });
    const { data: groupRows } = await supabase.from("group_students").select("group_id").eq("student_id", student.id);
    const groupIds = (groupRows ?? []).map((row) => row.group_id);
    if (groupIds.length === 0) return NextResponse.json({ lectures: [] });
    query = query.in("group_id", groupIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For students, scrub the host start_url for privacy.
  const lectures = (data ?? []).map((row: any) => {
    const meeting = Array.isArray(row.zoom_meetings) ? row.zoom_meetings[0] : row.zoom_meetings;
    const facultyJoin = Array.isArray(row.faculty_profiles) ? row.faculty_profiles[0] : row.faculty_profiles;
    const groupJoin = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const facultyProfile = facultyJoin?.profiles
      ? Array.isArray(facultyJoin.profiles)
        ? facultyJoin.profiles[0]
        : facultyJoin.profiles
      : null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      groupId: row.group_id,
      facultyId: row.faculty_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      attendanceThresholdPercent: Number(row.attendance_threshold_percent),
      groupName: groupJoin?.name ?? null,
      groupCode: groupJoin?.code ?? null,
      facultyName: facultyProfile?.full_name ?? null,
      zoom: meeting
        ? {
            zoomMeetingId: meeting.zoom_meeting_id,
            joinUrl: meeting.join_url,
            startUrl: auth.profile.role === "student" ? null : meeting.start_url,
            password: meeting.password
          }
        : null
    };
  });

  return NextResponse.json({ lectures });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const input = (await request.json()) as CreateLectureInput;
  const supabase = getSupabaseAdmin();

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyProfileId || facultyProfileId !== input.facultyId) {
      return NextResponse.json({ error: "Faculty can only create lectures for their own profile." }, { status: 403 });
    }
  }

  const { data: faculty, error: facultyError } = await supabase
    .from("faculty_profiles")
    .select("id, zoom_host_user_id")
    .eq("id", input.facultyId)
    .single();

  if (facultyError || !faculty?.zoom_host_user_id) {
    return NextResponse.json({ error: "Faculty Zoom host is not configured." }, { status: 400 });
  }

  const threshold = input.attendanceThresholdPercent ?? optionalNumberEnv("DEFAULT_ATTENDANCE_THRESHOLD", 70);
  let zoomMeeting: Awaited<ReturnType<typeof createZoomMeeting>>;

  try {
    zoomMeeting = await createZoomMeeting({
      hostUserId: faculty.zoom_host_user_id,
      topic: input.title,
      startsAt: input.startsAt,
      durationMinutes: minutesBetween(input.startsAt, input.endsAt)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Zoom meeting creation failed." }, { status: 502 });
  }

  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .insert({
      title: input.title,
      description: input.description ?? null,
      group_id: input.groupId,
      faculty_id: input.facultyId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      attendance_threshold_percent: threshold,
      created_by: auth.profile.id
    })
    .select("*")
    .single();

  if (lectureError) {
    return NextResponse.json({ error: lectureError.message }, { status: 400 });
  }

  const { error: meetingError } = await supabase.from("zoom_meetings").insert({
    lecture_id: lecture.id,
    zoom_meeting_id: String(zoomMeeting.id),
    zoom_uuid: zoomMeeting.uuid,
    host_id: zoomMeeting.host_id,
    join_url: zoomMeeting.join_url,
    start_url: zoomMeeting.start_url,
    password: zoomMeeting.password ?? null,
    raw_payload: zoomMeeting
  });

  if (meetingError) {
    return NextResponse.json({ error: meetingError.message }, { status: 500 });
  }

  await supabase.from("system_logs").insert({
    actor_id: auth.profile.id,
    action: "lecture.created",
    entity_type: "lectures",
    entity_id: lecture.id,
    metadata: { zoomMeetingId: zoomMeeting.id }
  });

  return NextResponse.json({ lecture, zoomMeeting });
}
