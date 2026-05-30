// Idempotent seed for the three baseline test accounts plus the seed group.

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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const seeds = [
  {
    email: "admin@example.com",
    password: env.ADMIN_PASSWORD ?? "Admin@123",
    fullName: "Admin User",
    role: "admin"
  },
  {
    email: "faculty@example.com",
    password: env.FACULTY_PASSWORD ?? "Faculty@123",
    fullName: "Faculty User",
    role: "faculty",
    facultyExtras: { employee_code: "FAC001", department: "Computer Science", zoom_host_user_id: "as9133106@gmail.com" }
  },
  {
    email: "student@example.com",
    password: env.STUDENT_PASSWORD ?? "Student@123",
    fullName: "Student User",
    role: "student",
    studentExtras: { roll_number: "STU001" }
  }
];

async function findUserByEmail(email) {
  // Walk pages until we find the email; the API doesn't expose a direct lookup.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

for (const seed of seeds) {
  let user = await findUserByEmail(seed.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: seed.email,
      password: seed.password,
      email_confirm: true,
      user_metadata: { full_name: seed.fullName }
    });
    if (error || !data.user) {
      console.error(`create ${seed.email}:`, error?.message);
      continue;
    }
    user = data.user;
    console.log(`created ${seed.email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: seed.password,
      email_confirm: true
    });
    if (error) console.error(`update ${seed.email}:`, error.message);
    else console.log(`reset ${seed.email}`);
  }

  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: seed.email,
      full_name: seed.fullName,
      role: seed.role,
      active: true
    },
    { onConflict: "id" }
  );

  if (seed.role === "faculty") {
    await admin.from("faculty_profiles").upsert({ user_id: user.id, ...seed.facultyExtras }, { onConflict: "user_id" });
  } else if (seed.role === "student") {
    await admin.from("student_profiles").upsert({ user_id: user.id, ...seed.studentExtras }, { onConflict: "user_id" });
  }
}

// Make sure there's at least one group and the seed student is enrolled in it.
const groupCode = "CS-A";
const { data: existing } = await admin.from("groups").select("id, name, code").eq("code", groupCode).maybeSingle();
let groupId = existing?.id;
if (!groupId) {
  const { data, error } = await admin
    .from("groups")
    .insert({ name: "CS A", code: groupCode, description: "Seed group" })
    .select("id")
    .single();
  if (error) console.error("group:", error.message);
  else {
    groupId = data.id;
    console.log("created seed group CS-A");
  }
}

if (groupId) {
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", (await findUserByEmail("student@example.com"))?.id)
    .maybeSingle();
  if (studentProfile) {
    await admin
      .from("group_students")
      .upsert({ group_id: groupId, student_id: studentProfile.id }, { onConflict: "group_id,student_id" });
    console.log(`enrolled student in ${groupCode}`);
  }
}

console.log("seed done");
