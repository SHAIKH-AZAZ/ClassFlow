import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { autoCompleteOverdueLectures } from "@/lib/lecture-status";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  await autoCompleteOverdueLectures(supabase);
  const [profiles, lectures, attendance, recordings, resources, jobs] = await Promise.all([
    supabase.from("profiles").select("id, role, active"),
    supabase.from("lectures").select("id, status, starts_at"),
    supabase.from("attendance").select("status"),
    supabase.from("recordings").select("id, file_size_bytes"),
    supabase.from("resources").select("id, size_bytes"),
    supabase.from("recording_jobs").select("status")
  ]);

  const errors = [profiles.error, lectures.error, attendance.error, recordings.error, resources.error, jobs.error].filter(Boolean);
  if (errors.length) {
    return NextResponse.json({ error: errors[0]?.message }, { status: 500 });
  }

  const profileRows = profiles.data ?? [];
  const attendanceRows = attendance.data ?? [];

  const recordingBytes = (recordings.data ?? []).reduce((acc, r: any) => acc + Number(r.file_size_bytes ?? 0), 0);
  const resourceBytes = (resources.data ?? []).reduce((acc, r: any) => acc + Number(r.size_bytes ?? 0), 0);

  const summary = {
    users: {
      total: profileRows.length,
      admins: profileRows.filter((p: any) => p.role === "admin").length,
      faculty: profileRows.filter((p: any) => p.role === "faculty").length,
      students: profileRows.filter((p: any) => p.role === "student").length,
      active: profileRows.filter((p: any) => p.active).length
    },
    lectures: {
      total: (lectures.data ?? []).length,
      upcoming: (lectures.data ?? []).filter((l: any) => new Date(l.starts_at) > new Date()).length,
      live: (lectures.data ?? []).filter((l: any) => l.status === "live").length,
      completed: (lectures.data ?? []).filter((l: any) => l.status === "completed").length
    },
    attendance: {
      total: attendanceRows.length,
      present: attendanceRows.filter((r: any) => r.status === "present").length,
      absent: attendanceRows.filter((r: any) => r.status === "absent").length,
      late: attendanceRows.filter((r: any) => r.status === "late").length,
      excused: attendanceRows.filter((r: any) => r.status === "excused").length
    },
    storage: {
      recordings: (recordings.data ?? []).length,
      recordingBytes,
      resources: (resources.data ?? []).length,
      resourceBytes
    },
    jobs: {
      queued: (jobs.data ?? []).filter((j: any) => j.status === "queued").length,
      processing: (jobs.data ?? []).filter((j: any) => j.status === "processing").length,
      completed: (jobs.data ?? []).filter((j: any) => j.status === "completed").length,
      failed: (jobs.data ?? []).filter((j: any) => j.status === "failed").length
    }
  };

  return NextResponse.json({ summary });
}
