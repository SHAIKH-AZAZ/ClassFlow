import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreateGroupBody = {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
};

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, code, description, active, created_at, group_students(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groups = (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    description: g.description,
    active: g.active,
    createdAt: g.created_at,
    studentCount: g.group_students?.[0]?.count ?? 0
  }));

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as CreateGroupBody;
  if (!body.name || !body.code) {
    return NextResponse.json({ error: "name and code are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: body.name,
      code: body.code,
      description: body.description ?? null,
      active: body.active ?? true
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ group: data });
}
