import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type Body = { email: string; password: string };

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "email and password required." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password
  });
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Sign in failed." }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    session: { expiresAt: data.session.expires_at }
  });
}
