import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UpdateUserBody = {
  fullName?: string;
  phone?: string | null;
  active?: boolean;
  password?: string;
  // faculty
  employeeCode?: string | null;
  department?: string | null;
  zoomHostUserId?: string | null;
  // student
  rollNumber?: string | null;
  guardianPhone?: string | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = (await request.json()) as UpdateUserBody;
  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const profileUpdates: Record<string, unknown> = {};
  if (body.fullName !== undefined) profileUpdates.full_name = body.fullName;
  if (body.phone !== undefined) profileUpdates.phone = body.phone;
  if (body.active !== undefined) profileUpdates.active = body.active;
  profileUpdates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("profiles").update(profileUpdates).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (body.password) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(id, { password: body.password });
    if (passwordError) return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  if (profile.role === "faculty") {
    const facultyUpdates: Record<string, unknown> = {};
    if (body.employeeCode !== undefined) facultyUpdates.employee_code = body.employeeCode;
    if (body.department !== undefined) facultyUpdates.department = body.department;
    if (body.zoomHostUserId !== undefined) facultyUpdates.zoom_host_user_id = body.zoomHostUserId;
    if (Object.keys(facultyUpdates).length > 0) {
      const { error } = await supabase.from("faculty_profiles").update(facultyUpdates).eq("user_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (profile.role === "student") {
    const studentUpdates: Record<string, unknown> = {};
    if (body.rollNumber !== undefined) studentUpdates.roll_number = body.rollNumber;
    if (body.guardianPhone !== undefined) studentUpdates.guardian_phone = body.guardianPhone;
    if (Object.keys(studentUpdates).length > 0) {
      const { error } = await supabase.from("student_profiles").update(studentUpdates).eq("user_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase.from("system_logs").insert({
    actor_id: auth.profile.id,
    action: "user.updated",
    entity_type: "profiles",
    entity_id: id,
    metadata: { fields: Object.keys(profileUpdates) }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (id === auth.profile.id) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("system_logs").insert({
    actor_id: auth.profile.id,
    action: "user.deleted",
    entity_type: "profiles",
    entity_id: id,
    metadata: {}
  });

  return NextResponse.json({ ok: true });
}
