import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getRoleHome, isRoleAllowed, type AppRole, type Profile } from "./auth-constants";
import { getSupabaseServerClient } from "./supabase-server";
import { getSupabaseAdmin } from "./supabase-admin";

type AuthContext = {
  user: User | null;
  profile: Profile | null;
};

async function userFromBearerToken(): Promise<User | null> {
  try {
    const headerList = await nextHeaders();
    const authHeader = headerList.get("authorization") ?? headerList.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function getCurrentAuthContext(): Promise<AuthContext> {
  // Bearer token path used by the mobile app.
  const bearerUser = await userFromBearerToken();
  let user: User | null = bearerUser;

  if (!user) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user: cookieUser }
    } = await supabase.auth.getUser();
    user = cookieUser;
  }

  if (!user) {
    return { user: null, profile: null };
  }

  // Use the service-role client to read the profile so this works regardless
  // of RLS configuration. The user is already authenticated above; this just
  // enriches the context.
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return {
    user,
    profile: profile?.active ? profile : null
  };
}

export async function requirePageRole(roles: AppRole[], currentPath: string) {
  const { user, profile } = await getCurrentAuthContext();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }

  if (!profile || !isRoleAllowed(profile.role, roles)) {
    redirect(getRoleHome(profile?.role));
  }

  return { user, profile };
}

export async function requireApiRole(roles: AppRole[]) {
  const { user, profile } = await getCurrentAuthContext();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      user: null,
      profile: null
    };
  }

  if (!profile || !isRoleAllowed(profile.role, roles)) {
    return {
      error: NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 }),
      user,
      profile
    };
  }

  return { error: null, user, profile };
}

export async function getFacultyProfileIdForUser(userId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("faculty_profiles").select("id").eq("user_id", userId).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function getStudentProfileIdForUser(userId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("student_profiles").select("id").eq("user_id", userId).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}
