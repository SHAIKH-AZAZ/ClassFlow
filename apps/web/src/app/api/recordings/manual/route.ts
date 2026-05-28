import { NextResponse } from "next/server";
import { ensureDriveFolder, uploadFileToDrive } from "@/lib/google-drive";
import { requireEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getFacultyProfileIdForUser, requireApiRole } from "@/lib/auth-server";

export const runtime = "nodejs";

function safeFolderName(value: string) {
  return value.replace(/[\\/<>:"|?*]+/g, "-").trim() || "Untitled";
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const lectureId = String(formData.get("lectureId") ?? "");
  const file = formData.get("file");

  if (!lectureId || !(file instanceof File)) {
    return NextResponse.json({ error: "lectureId and file are required." }, { status: 400 });
  }

  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Upload a video recording file." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .select("id, title, faculty_id, starts_at, groups(name, code), zoom_meetings(zoom_meeting_id)")
    .eq("id", lectureId)
    .single();

  if (lectureError || !lecture) {
    return NextResponse.json({ error: lectureError?.message ?? "Lecture not found." }, { status: 404 });
  }

  if (auth.profile.role === "faculty") {
    const facultyProfileId = await getFacultyProfileIdForUser(auth.user.id);
    if (!facultyProfileId || facultyProfileId !== lecture.faculty_id) {
      return NextResponse.json({ error: "Faculty can only upload recordings for their own lectures." }, { status: 403 });
    }
  }

  const group = Array.isArray(lecture.groups) ? lecture.groups[0] : lecture.groups;
  const zoomMeeting = Array.isArray(lecture.zoom_meetings) ? lecture.zoom_meetings[0] : lecture.zoom_meetings;
  const groupName = safeFolderName(group?.name ?? group?.code ?? "Group");
  const lectureDate = new Date(lecture.starts_at).toISOString().slice(0, 10);
  const rootId = requireEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");

  const groupsFolderId = await ensureDriveFolder("Groups", rootId);
  const groupFolderId = await ensureDriveFolder(groupName, groupsFolderId);
  const lecturesFolderId = await ensureDriveFolder("Lectures", groupFolderId);
  const dateFolderId = await ensureDriveFolder(lectureDate, lecturesFolderId);

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".mp4";
  const driveFile = await uploadFileToDrive({
    name: `${safeFolderName(lecture.title)}${extension}`,
    mimeType: file.type || "video/mp4",
    parentId: dateFolderId,
    file
  });

  const { data: recording, error: recordingError } = await supabase
    .from("recordings")
    .insert({
      lecture_id: lecture.id,
      zoom_meeting_id: zoomMeeting?.zoom_meeting_id ?? `manual:${lecture.id}`,
      zoom_recording_id: null,
      drive_file_id: driveFile.id,
      view_url: driveFile.viewUrl,
      download_url: driveFile.downloadUrl,
      file_size_bytes: driveFile.size
    })
    .select("*")
    .single();

  if (recordingError) {
    return NextResponse.json({ error: recordingError.message }, { status: 500 });
  }

  await supabase.from("system_logs").insert({
    actor_id: auth.profile.id,
    action: "recording.manual_upload",
    entity_type: "recordings",
    entity_id: recording.id,
    metadata: {
      lectureId: lecture.id,
      driveFileId: driveFile.id,
      fileName: file.name
    }
  });

  return NextResponse.json({ recording });
}
