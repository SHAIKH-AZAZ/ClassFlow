import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreateUserBody = {
  role: "admin" | "faculty" | "student";
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  // faculty fields
  employeeCode?: string;
  department?: string;
  zoomHostUserId?: string;
  // student fields
  rollNumber?: string;
  guardianPhone?: string;
};

export async function GET() {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const supabase = getSupabaseAdmin();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, email, phone, full_name, role, active, created_at, faculty_profiles(id, employee_code, department, zoom_host_user_id), student_profiles(id, roll_number, guardian_phone)"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as CreateUserBody;
  if (!body.email || !body.password || !body.fullName || !body.role) {
    return NextResponse.json({ error: "email, password, fullName, role are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: body.fullName
    }
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create auth user." }, { status: 400 });
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: body.email,
        phone: body.phone ?? null,
        full_name: body.fullName,
        role: body.role,
        active: true
      },
      { onConflict: "id" }
    );

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (body.role === "faculty") {
    const { error: facultyError } = await supabase.from("faculty_profiles").upsert(
      {
        user_id: userId,
        employee_code: body.employeeCode ?? null,
        department: body.department ?? null,
        zoom_host_user_id: body.zoomHostUserId ?? null
      },
      { onConflict: "user_id" }
    );
    if (facultyError) {
      return NextResponse.json({ error: facultyError.message }, { status: 500 });
    }
  } else if (body.role === "student") {
    const { error: studentError } = await supabase.from("student_profiles").upsert(
      {
        user_id: userId,
        roll_number: body.rollNumber ?? null,
        guardian_phone: body.guardianPhone ?? null
      },
      { onConflict: "user_id" }
    );
    if (studentError) {
      return NextResponse.json({ error: studentError.message }, { status: 500 });
    }
  }

  await supabase.from("system_logs").insert({
    actor_id: auth.profile.id,
    action: "user.created",
    entity_type: "profiles",
    entity_id: userId,
    metadata: { role: body.role, email: body.email }
  });

  return NextResponse.json({ id: userId });
}
