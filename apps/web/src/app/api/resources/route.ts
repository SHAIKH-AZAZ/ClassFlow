import { NextResponse } from "next/server";
import type { CreateResourceInput } from "@zoom-lms/shared";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const input = (await request.json()) as CreateResourceInput;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("resources")
    .insert({
      owner_id: input.ownerId,
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ resource: data });
}
