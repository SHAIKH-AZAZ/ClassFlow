import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const accounts = [
  { email: "admin@example.com", password: env.ADMIN_PASSWORD ?? "Admin@123" },
  { email: "faculty@example.com", password: env.FACULTY_PASSWORD ?? "Faculty@123" },
  { email: "student@example.com", password: env.STUDENT_PASSWORD ?? "Student@123" }
];

for (const acc of accounts) {
  // Look up user id via list
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (listErr) {
    console.error("list users:", listErr.message);
    process.exit(1);
  }
  const found = list.users.find((u) => u.email === acc.email);
  if (!found) {
    console.error(`User ${acc.email} not found.`);
    continue;
  }
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    password: acc.password,
    email_confirm: true
  });
  if (error) {
    console.error(`reset ${acc.email}:`, error.message);
  } else {
    console.log(`reset ${acc.email} → ${acc.password}`);
  }
}
