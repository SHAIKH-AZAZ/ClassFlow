import { google, type drive_v3 } from "googleapis";
import { requireEnv } from "./env";

let driveClient: drive_v3.Drive | null = null;

export function getDriveClient() {
  if (!driveClient) {
    const auth = new google.auth.JWT({
      email: requireEnv("GOOGLE_CLIENT_EMAIL"),
      key: requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive"]
    });

    driveClient = google.drive({ version: "v3", auth });
  }

  return driveClient;
}

export async function ensureDriveFolder(name: string, parentId: string) {
  const drive = getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1
  });

  const folder = existing.data.files?.[0];
  if (folder?.id) return folder.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id"
  });

  if (!created.data.id) {
    throw new Error(`Failed to create Drive folder ${name}`);
  }

  return created.data.id;
}
