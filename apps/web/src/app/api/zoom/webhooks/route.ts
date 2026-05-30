import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function verifyZoomWebhook(rawBody: string, request: Request) {
  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!timestamp || !signature) return false;

  const message = `v0:${timestamp}:${rawBody}`;
  const hash = crypto.createHmac("sha256", requireEnv("ZOOM_WEBHOOK_SECRET_TOKEN")).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`v0=${hash}`));
}

async function setLectureStatusForMeeting(meetingId: string, status: "live" | "completed") {
  const supabase = getSupabaseAdmin();
  const { data: meeting } = await supabase
    .from("zoom_meetings")
    .select("lecture_id")
    .eq("zoom_meeting_id", meetingId)
    .maybeSingle();
  if (!meeting?.lecture_id) return;

  const update: Record<string, string> = { status, updated_at: new Date().toISOString() };
  await supabase.from("lectures").update(update).eq("id", meeting.lecture_id);

  await supabase.from("system_logs").insert({
    actor_id: null,
    action: `lecture.${status === "live" ? "started" : "completed"}`,
    entity_type: "lectures",
    entity_id: meeting.lecture_id,
    metadata: { source: "zoom_webhook", meetingId }
  });
}

async function handleRecordingCompleted(meetingId: string, object: any) {
  const supabase = getSupabaseAdmin();
  const { data: meeting } = await supabase
    .from("zoom_meetings")
    .select("lecture_id")
    .eq("zoom_meeting_id", meetingId)
    .maybeSingle();

  for (const file of object?.recording_files ?? []) {
    if (!file.download_url) continue;

    const { data: recording, error: recordingError } = await supabase
      .from("recordings")
      .insert({
        lecture_id: meeting?.lecture_id ?? null,
        zoom_meeting_id: meetingId,
        zoom_recording_id: file.id ?? null,
        duration_seconds:
          file.recording_end && file.recording_start
            ? Math.round((new Date(file.recording_end).getTime() - new Date(file.recording_start).getTime()) / 1000)
            : null,
        file_size_bytes: file.file_size ?? null
      })
      .select("id")
      .single();

    if (recordingError) {
      throw new Error(recordingError.message);
    }

    const { error: jobError } = await supabase.from("recording_jobs").insert({
      recording_id: recording.id,
      zoom_download_url: file.download_url,
      status: "queued"
    });

    if (jobError) {
      throw new Error(jobError.message);
    }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = JSON.parse(rawBody);

  if (payload.event === "endpoint.url_validation") {
    const plainToken = payload.payload?.plainToken;
    const encryptedToken = crypto
      .createHmac("sha256", requireEnv("ZOOM_WEBHOOK_SECRET_TOKEN"))
      .update(plainToken)
      .digest("hex");
    return NextResponse.json({ plainToken, encryptedToken });
  }

  if (!verifyZoomWebhook(rawBody, request)) {
    return NextResponse.json({ error: "Invalid Zoom webhook signature." }, { status: 401 });
  }

  const object = payload.payload?.object;
  const meetingId = String(object?.id ?? "");

  try {
    switch (payload.event) {
      case "meeting.started":
        if (meetingId) await setLectureStatusForMeeting(meetingId, "live");
        return NextResponse.json({ ok: true });
      case "meeting.ended":
        if (meetingId) await setLectureStatusForMeeting(meetingId, "completed");
        return NextResponse.json({ ok: true });
      case "recording.completed":
        if (meetingId) await handleRecordingCompleted(meetingId, object);
        return NextResponse.json({ queued: true });
      default:
        return NextResponse.json({ ignored: true, event: payload.event });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 }
    );
  }
}
