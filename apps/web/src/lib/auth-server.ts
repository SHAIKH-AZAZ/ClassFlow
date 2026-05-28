import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getRoleHome, isRoleAllowed, type AppRole, type Profile } from "./auth-constants";
import { getSupabaseServerClient } from "./supabase-server";

type AuthContext = {
  user: User | null;
  profile: Profile | null;
};

export async function getCurrentAuthContext(): Promise<AuthContext> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
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
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("faculty_profiles").select("id").eq("user_id", userId).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function getStudentProfileIdForUser(userId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("student_profiles").select("id").eq("user_id", userId).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}
