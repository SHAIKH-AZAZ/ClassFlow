import { NextResponse } from "next/server";
import type { CreateLectureInput } from "@zoom-lms/shared";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createZoomMeeting } from "@/lib/zoom";
import { optionalNumberEnv } from "@/lib/env";
import { minutesBetween } from "@/lib/attendance";

export async function POST(request: Request) {
  const input = (await request.json()) as CreateLectureInput;
  const supabase = getSupabaseAdmin();

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
      attendance_threshold_percent: threshold
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

  return NextResponse.json({ lecture, zoomMeeting });
}
