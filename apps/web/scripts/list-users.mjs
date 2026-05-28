import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../.env.local");
const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, email, full_name, role, active")
  .order("role");

console.log(JSON.stringify(profiles, null, 2));

const { data: groups } = await supabase.from("groups").select("id, name, code, active");
console.log("groups:", JSON.stringify(groups, null, 2));

const { data: faculty } = await supabase
  .from("faculty_profiles")
  .select("id, user_id, zoom_host_user_id, profiles(full_name, email)");
console.log("faculty:", JSON.stringify(faculty, null, 2));

const { data: students } = await supabase
  .from("student_profiles")
  .select("id, user_id, roll_number, profiles(full_name, email)");
console.log("students:", JSON.stringify(students, null, 2));
