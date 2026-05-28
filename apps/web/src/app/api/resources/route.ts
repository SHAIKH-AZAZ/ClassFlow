import { NextResponse } from "next/server";
import { inferResourceKind, type CreateResourceInput, type ResourceKind } from "@zoom-lms/shared";
import { requireApiRole } from "@/lib/auth-server";
import { ensureDriveFolder, uploadFileToDrive } from "@/lib/google-drive";
import { requireEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function safeFolderName(value: string) {
  return value.replace(/[\\/<>:"|?*]+/g, "-").trim() || "Untitled";
}

export async function GET(request: Request) {
  const auth = await requireApiRole(["admin", "faculty", "student"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");

  let query = supabase
    .from("resources")
    .select("id, owner_id, group_id, title, kind, size_bytes, drive_file_id, view_url, download_url, created_at, groups(name, code), profiles(full_name)")
    .order("created_at", { ascending: false });

  if (groupId) query = query.eq("group_id", groupId);

  if (auth.profile.role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!student) return NextResponse.json({ resources: [] });
    const { data: groupRows } = await supabase.from("group_students").select("group_id").eq("student_id", student.id);
    const groupIds = (groupRows ?? []).map((r) => r.group_id);
    if (groupIds.length === 0) return NextResponse.json({ resources: [] });
    query = query.in("group_id", groupIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resources = (data ?? []).map((row: any) => {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const owner = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      ownerId: row.owner_id,
      ownerName: owner?.full_name ?? null,
      groupId: row.group_id,
      groupName: group?.name ?? null,
      groupCode: group?.code ?? null,
      title: row.title,
      kind: row.kind,
      sizeBytes: Number(row.size_bytes ?? 0),
      driveFileId: row.drive_file_id,
      viewUrl: row.view_url,
      downloadUrl: row.download_url,
      createdAt: row.created_at
    };
  });

  return NextResponse.json({ resources });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin", "faculty"]);
  if (auth.error) return auth.error;

  const contentType = request.headers.get("content-type") ?? "";
  const supabase = getSupabaseAdmin();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const groupId = String(formData.get("groupId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const kindInput = String(formData.get("kind") ?? "").trim();
    const file = formData.get("file");

    if (!groupId || !title || !(file instanceof File)) {
      return NextResponse.json({ error: "groupId, title and file are required." }, { status: 400 });
    }

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name, code")
      .eq("id", groupId)
      .single();
    if (groupError || !group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    const rootId = requireEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
    const groupsFolderId = await ensureDriveFolder("Groups", rootId);
    const groupFolderId = await ensureDriveFolder(safeFolderName(group.name), groupsFolderId);
    const resourcesFolderId = await ensureDriveFolder("Resources", groupFolderId);

    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const driveFile = await uploadFileToDrive({
      name: `${safeFolderName(title)}${extension}`,
      mimeType: file.type || "application/octet-stream",
      parentId: resourcesFolderId,
      file
    });

    const kind: ResourceKind = (kindInput as ResourceKind) || inferResourceKind(file.type, file.name);

    const { data, error } = await supabase
      .from("resources")
      .insert({
        owner_id: auth.profile.id,
        group_id: groupId,
        title,
        kind,
        size_bytes: driveFile.size,
        drive_file_id: driveFile.id,
        view_url: driveFile.viewUrl ?? "",
        download_url: driveFile.downloadUrl
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from("system_logs").insert({
      actor_id: auth.profile.id,
      action: "resource.uploaded",
      entity_type: "resources",
      entity_id: data.id,
      metadata: { driveFileId: driveFile.id, groupId, fileName: file.name }
    });

    return NextResponse.json({ resource: data });
  }

  const input = (await request.json()) as CreateResourceInput;
  const { data, error } = await supabase
    .from("resources")
    .insert({
      owner_id: auth.profile.id,
      group_id: input.groupId,
      title: input.title,
      kind: input.kind,
      size_bytes: input.sizeBytes,
      drive_file_id: input.driveFileId,
      view_url: input.viewUrl,
      download_url: input.downloadUrl ?? null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ resource: data });
}
