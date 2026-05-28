import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getAllowedRolesForPath, getRoleHome, isRoleAllowed, type Profile } from "@/lib/auth-constants";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const pathname = request.nextUrl.pathname;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    // Use a service-role client (bypasses RLS) to fetch the profile.
    // The user is already authenticated above; this is just a role lookup
    // to decide whether the request is allowed to reach the page.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle<Profile>();
    profile = data?.active ? data : null;
  }

  if (pathname === "/login") {
    if (profile) {
      return NextResponse.redirect(new URL(getRoleHome(profile.role), request.url));
    }
    return response;
  }

  const allowedRoles = getAllowedRolesForPath(pathname);
  if (!allowedRoles) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!profile || !isRoleAllowed(profile.role, allowedRoles)) {
    return NextResponse.redirect(new URL(getRoleHome(profile?.role), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin/:path*",
    "/faculty/:path*",
    "/student/:path*",
    "/notices/:path*",
    "/chat/:path*",
    "/reports/:path*",
    "/settings/:path*"
  ]
};
