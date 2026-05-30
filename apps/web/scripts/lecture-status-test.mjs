// Verifies that calling GET /api/lectures auto-completes any overdue lectures.

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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// 1. Find existing seed group + faculty.
const { data: group } = await admin.from("groups").select("id").eq("code", "CS-A").single();
const { data: faculty } = await admin
  .from("faculty_profiles")
  .select("id, profiles(email)")
  .eq("profiles.email", "faculty@example.com")
  .single();

const yesterdayStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const yesterdayEnd = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

// 2. Insert an overdue scheduled lecture directly.
const { data: inserted, error: insErr } = await admin
  .from("lectures")
  .insert({
    title: "[Status test] Overdue lecture",
    group_id: group.id,
    faculty_id: faculty.id,
    starts_at: yesterdayStart,
    ends_at: yesterdayEnd,
    status: "scheduled",
    attendance_threshold_percent: 70
  })
  .select("id, status")
  .single();

if (insErr) {
  console.error("insert failed:", insErr.message);
  process.exit(1);
}
console.log("seed lecture:", inserted);

// 3. Login as admin to call the API normally.
const cookies = {};
function applySetCookies(set) {
  for (const sc of set ?? []) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (value === "" && /max-age=0/i.test(sc)) delete cookies[name];
    else cookies[name] = value;
  }
}
function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: env.ADMIN_PASSWORD ?? "Admin@123" })
});
applySetCookies(login.headers.getSetCookie?.() ?? []);

// 4. Trigger the GET, which should run the sweep.
const list = await fetch(`${BASE}/api/lectures`, { headers: { cookie: cookieHeader() } });
console.log("list status:", list.status);

// 5. Verify the lecture row is now completed.
const { data: refreshed } = await admin
  .from("lectures")
  .select("id, status")
  .eq("id", inserted.id)
  .single();

console.log("after sweep:", refreshed);

if (refreshed.status !== "completed") {
  console.error("❌ status was not auto-flipped to completed");
  process.exit(1);
}
console.log("✅ overdue lecture auto-completed");

// 6. Cleanup.
await admin.from("lectures").delete().eq("id", inserted.id);
console.log("cleaned up");
