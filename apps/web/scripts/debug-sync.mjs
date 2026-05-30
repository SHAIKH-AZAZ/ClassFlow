// Reproduce the attendance sync 500 to see the actual server error message.
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

const { data: signin, error: signinErr } = await supa.auth.signInWithPassword({
  email: "faculty@example.com",
  password: env.FACULTY_PASSWORD ?? "Faculty@123"
});
if (signinErr) {
  console.error("login failed:", signinErr.message);
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
const { data: facultyRow } = await admin
  .from("faculty_profiles")
  .select("id")
  .eq("user_id", signin.user.id)
  .maybeSingle();
const { data: lectures } = await admin
  .from("lectures")
  .select("id, title, faculty_id, zoom_meetings(zoom_meeting_id)")
  .eq("faculty_id", facultyRow.id)
  .limit(5);

console.log("faculty lectures:");
for (const l of lectures ?? []) {
  console.log(`- ${l.title}`);
  console.log(`  id=${l.id}`);
  console.log(`  zoom_meeting=${JSON.stringify(l.zoom_meetings)}`);
}

const target = (lectures ?? [])[0];
if (!target) {
  console.log("no lectures to sync");
  process.exit(0);
}

const res = await fetch(`${BASE}/api/attendance/sync`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${signin.session?.access_token}`
  },
  body: JSON.stringify({ lectureId: target.id })
});
const text = await res.text();
console.log(`status: ${res.status}`);
console.log(text);
