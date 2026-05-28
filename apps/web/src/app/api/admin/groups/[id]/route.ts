import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UpdateBody = {
  name?: string;
  code?: string;
  description?: string | null;
  active?: boolean;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = (await request.json()) as UpdateBody;
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.code !== undefined) updates.code = body.code;
  if (body.description !== undefined) updates.description = body.description;
  if (body.active !== undefined) updates.active = body.active;

  const { data, error } = await supabase.from("groups").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ group: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
