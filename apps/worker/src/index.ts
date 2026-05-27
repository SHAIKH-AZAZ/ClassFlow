import { Readable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const drive = google.drive({
  version: "v3",
  auth: new google.auth.JWT({
    email: requireEnv("GOOGLE_CLIENT_EMAIL"),
    key: requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"]
  })
});

async function getZoomAccessToken() {
  const credentials = Buffer.from(`${requireEnv("ZOOM_CLIENT_ID")}:${requireEnv("ZOOM_CLIENT_SECRET")}`).toString("base64");
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${requireEnv("ZOOM_ACCOUNT_ID")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Zoom token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function claimNextJob() {
  const { data: jobs, error } = await supabase
    .from("recording_jobs")
    .select("id, recording_id, zoom_download_url, attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  const job = jobs?.[0];
  if (!job) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("recording_jobs")
    .update({ status: "processing", locked_at: new Date().toISOString(), attempts: job.attempts + 1 })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id, recording_id, zoom_download_url")
    .single();

  if (claimError) return null;
  return claimed;
}

async function processJob(job: { id: string; recording_id: string; zoom_download_url: string }) {
  const token = await getZoomAccessToken();
  const recordingResponse = await fetch(job.zoom_download_url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!recordingResponse.ok || !recordingResponse.body) {
    throw new Error(`Zoom recording download failed: ${recordingResponse.status} ${await recordingResponse.text()}`);
  }

  const created = await drive.files.create({
    requestBody: {
      name: `recording-${job.recording_id}.mp4`,
      parents: [requireEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID")]
    },
    media: {
      mimeType: "video/mp4",
      body: Readable.fromWeb(recordingResponse.body as any)
    },
    fields: "id, webViewLink, webContentLink, size"
  });

  const driveFile = created.data;
  if (!driveFile.id) {
    throw new Error("Google Drive upload did not return a file id.");
  }

  await supabase
    .from("recordings")
    .update({
      drive_file_id: driveFile.id,
      view_url: driveFile.webViewLink ?? null,
      download_url: driveFile.webContentLink ?? null,
      file_size_bytes: driveFile.size ? Number(driveFile.size) : null
    })
    .eq("id", job.recording_id);

  await supabase.from("recording_jobs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);
}

async function markFailed(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await supabase
    .from("recording_jobs")
    .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function tick() {
  const job = await claimNextJob();
  if (!job) return;

  try {
    await processJob(job);
    console.log(`Completed recording job ${job.id}`);
  } catch (error) {
    await markFailed(job.id, error);
    console.error(`Failed recording job ${job.id}`, error);
  }
}

async function main() {
  const interval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15_000);
  console.log(`Recording worker started. Poll interval: ${interval}ms`);
  await tick();
  setInterval(() => {
    tick().catch((error) => console.error("Worker tick failed", error));
  }, interval);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
