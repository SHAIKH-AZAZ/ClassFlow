import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UpsertBody = {
  key: string;
  value: unknown;
  encrypted?: boolean;
};

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("integration_settings")
    .select("key, value, encrypted, updated_at")
    .order("key", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as UpsertBody;
  if (!body.key) return NextResponse.json({ error: "key is required." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("integration_settings")
    .upsert(
      { key: body.key, value: body.value ?? null, encrypted: body.encrypted ?? false, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ setting: data });
}
