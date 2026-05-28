import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../.env.local"), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

// 1. Check via service role: are policies present?
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
const { data: pols } = await admin.from("pg_policies").select("*").limit(1).maybeSingle();
console.log("policies select via PostgREST:", pols);

// 2. Check the function exists
const { data: roleCheck, error: roleErr } = await admin.rpc("current_profile_role");
console.log("rpc current_profile_role (service role):", roleCheck, roleErr?.message);

// 3. Sign in as admin via anon key, then query profiles
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});
const { data: signin, error: signinErr } = await anon.auth.signInWithPassword({
  email: "admin@example.com",
  password: env.ADMIN_PASSWORD ?? "Admin@123"
});
if (signinErr) {
  console.log("admin signin failed:", signinErr.message);
  process.exit(1);
}
console.log("admin uid:", signin.user.id);

const { data: profile, error: profileErr } = await anon
  .from("profiles")
  .select("id, full_name, role, active")
  .eq("id", signin.user.id)
  .maybeSingle();
console.log("anon-key profile lookup:", profile, profileErr?.message);

// 4. Try without filter to see what it returns
const { data: any, error: anyErr } = await anon.from("profiles").select("id, role").limit(5);
console.log("anon-key profiles list (RLS-filtered):", any, anyErr?.message);

// 5. Service-role read sanity check
const { data: srv } = await admin.from("profiles").select("id, role").limit(5);
console.log("service-role profiles list:", srv);
