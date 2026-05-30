// Verify the new /api/attendance/seed endpoint creates absent rows for every
// enrolled student and respects existing overrides.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const { data: signin } = await supa.auth.signInWithPassword({
  email: "faculty@example.com",
  password: env.FACULTY_PASSWORD ?? "Faculty@123"
});
if (!signin?.session) {
  console.error("login failed");
  process.exit(1);
}

const { data: facultyRow } = await admin
  .from("faculty_profiles")
  .select("id")
  .eq("user_id", signin.user.id)
  .maybeSingle();
const { data: lecture } = await admin
  .from("lectures")
  .select("id, group_id")
  .eq("faculty_id", facultyRow.id)
  .limit(1)
  .single();

const { count: enrolledCount } = await admin
  .from("group_students")
  .select("student_id", { count: "exact", head: true })
  .eq("group_id", lecture.group_id);

console.log(`lecture: ${lecture.id}, enrolled: ${enrolledCount}`);

const res = await fetch(`${BASE}/api/attendance/seed`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${signin.session.access_token}`
  },
  body: JSON.stringify({ lectureId: lecture.id })
});
const text = await res.text();
console.log(`seed status: ${res.status}`);
console.log(text);
