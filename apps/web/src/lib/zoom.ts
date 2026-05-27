import { requireEnv } from "./env";

type ZoomTokenResponse = {
  access_token: string;
  expires_in: number;
};

type CreateZoomMeetingInput = {
  hostUserId: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

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

  const data = (await response.json()) as ZoomTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };
  return cachedToken.token;
}

export async function createZoomMeeting(input: CreateZoomMeetingInput) {
  const token = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(input.hostUserId)}/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startsAt,
      duration: input.durationMinutes,
      timezone: "UTC",
      settings: {
        join_before_host: false,
        waiting_room: true,
        approval_type: 0,
        auto_recording: "cloud"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Zoom meeting creation failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{
    id: number;
    uuid: string;
    host_id: string;
    join_url: string;
    start_url: string;
    password?: string;
  }>;
}

export async function listZoomParticipants(zoomMeetingId: string) {
  const token = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/report/meetings/${encodeURIComponent(zoomMeetingId)}/participants?page_size=300`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Zoom participant report failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{
    participants: Array<{ user_email?: string; name: string; duration: number }>;
  }>;
}
