// Deeper functional pass: exercise admin user/group lifecycle, faculty lecture
// CRUD, notices, remarks, chat threads. Targets the running dev server on
// port 3001 by default.

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

const BASE = process.env.BASE ?? "http://localhost:3001";

const accounts = [
  { role: "admin", email: "admin@example.com", password: env.ADMIN_PASSWORD ?? "Admin@123" },
  { role: "faculty", email: "faculty@example.com", password: env.FACULTY_PASSWORD ?? "Faculty@123" },
  { role: "student", email: "student@example.com", password: env.STUDENT_PASSWORD ?? "Student@123" }
];

const log = [];
function step(name, fn) {
  return async () => {
    try {
      const result = await fn();
      log.push({ name, ok: true, info: result });
      console.log(`✅ ${name}${result ? ` — ${result}` : ""}`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.push({ name, ok: false, info: message });
      console.log(`❌ ${name} — ${message}`);
      throw err;
    }
  };
}

function parseSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const out = [];
  for (const [k, v] of headers) if (k.toLowerCase() === "set-cookie") out.push(v);
  return out;
}
function applySetCookies(jar, setCookies) {
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (value === "" && /max-age=0/i.test(sc)) delete jar[name];
    else jar[name] = value;
  }
}
function cookieHeader(jar) {
  return Object.entries(jar).map(([n, v]) => `${n}=${v}`).join("; ");
}

async function call(account, path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (account.cookies && Object.keys(account.cookies).length) headers.set("cookie", cookieHeader(account.cookies));
  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  let res;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    if (res.status !== 500) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  applySetCookies(account.cookies, parseSetCookies(res.headers));
  let body = null;
  if (res.headers.get("content-type")?.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function loginAll() {
  for (const account of accounts) {
    account.cookies = {};
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    if (!r.ok) throw new Error(`${account.role} login failed: ${r.status}`);
    applySetCookies(account.cookies, parseSetCookies(r.headers));
  }
}

const created = {};

async function adminLifecycle() {
  const admin = accounts.find((a) => a.role === "admin");

  await step("admin can read users", async () => {
    const json = await call(admin, "/api/admin/users");
    return `${json.profiles.length} profiles`;
  })();

  const ts = Date.now();
  const newUser = {
    role: "student",
    email: `temp-${ts}@example.com`,
    password: "TempPass@123",
    fullName: "Temp Student",
    rollNumber: `T-${ts}`
  };
  const id = await step("admin creates a temp student", async () => {
    const json = await call(admin, "/api/admin/users", { method: "POST", body: JSON.stringify(newUser) });
    return `id=${json.id.slice(0, 8)}`;
  })();
  // pull it back for the id
  const usersJson = await call(admin, "/api/admin/users");
  const tempProfile = usersJson.profiles.find((p) => p.email === newUser.email);
  if (!tempProfile) throw new Error("temp user not visible after create");
  created.tempUserId = tempProfile.id;
  // Some PostgREST queries return the joined relation as either an object or
  // an array depending on the Supabase client version; handle both.
  const studentJoin = Array.isArray(tempProfile.student_profiles)
    ? tempProfile.student_profiles[0]
    : tempProfile.student_profiles;
  created.tempStudentId = studentJoin?.id ?? null;
  if (!created.tempStudentId) {
    // Fall back to a fresh fetch in case of replication delay.
    await new Promise((r) => setTimeout(r, 600));
    const refreshed = await call(admin, "/api/admin/users");
    const refreshedProfile = refreshed.profiles.find((p) => p.email === newUser.email);
    const refreshedJoin = Array.isArray(refreshedProfile?.student_profiles)
      ? refreshedProfile.student_profiles[0]
      : refreshedProfile?.student_profiles;
    created.tempStudentId = refreshedJoin?.id ?? null;
  }

  await step("admin updates temp student fields", async () =>
    call(admin, `/api/admin/users/${tempProfile.id}`, {
      method: "PATCH",
      body: JSON.stringify({ phone: "+1555-0123", rollNumber: `T2-${ts}` })
    }).then(() => "ok")
  )();

  // Create a fresh group, enroll the temp student, then drop them.
  const groupCode = `TG-${ts}`;
  const groupResp = await step("admin creates a temp group", async () => {
    const json = await call(admin, "/api/admin/groups", {
      method: "POST",
      body: JSON.stringify({ name: `Temp Group ${ts}`, code: groupCode, description: "ephemeral" })
    });
    return `id=${json.group.id.slice(0, 8)}`;
  })();
  const groupsJson = await call(admin, "/api/admin/groups");
  const tempGroup = groupsJson.groups.find((g) => g.code === groupCode);
  created.tempGroupId = tempGroup.id;

  await step("admin enrolls temp student in temp group", async () => {
    if (!created.tempStudentId) throw new Error("no student profile id");
    return call(admin, `/api/admin/groups/${tempGroup.id}/students`, {
      method: "POST",
      body: JSON.stringify({ studentId: created.tempStudentId })
    }).then(() => "ok");
  })();

  await step("admin lists enrolled students", async () => {
    const json = await call(admin, `/api/admin/groups/${tempGroup.id}/students`);
    return `${json.enrollments.length} enrollment(s)`;
  })();

  await step("admin removes the enrollment", async () =>
    call(admin, `/api/admin/groups/${tempGroup.id}/students?studentId=${created.tempStudentId}`, {
      method: "DELETE"
    }).then(() => "ok")
  )();

  await step("admin deletes temp group", async () =>
    call(admin, `/api/admin/groups/${tempGroup.id}`, { method: "DELETE" }).then(() => "ok")
  )();

  await step("admin deletes temp student", async () =>
    call(admin, `/api/admin/users/${tempProfile.id}`, { method: "DELETE" }).then(() => "ok")
  )();
}

async function facultyAndStudent() {
  const faculty = accounts.find((a) => a.role === "faculty");
  const student = accounts.find((a) => a.role === "student");
  const admin = accounts.find((a) => a.role === "admin");

  // Faculty list lectures (own)
  await step("faculty lists own lectures", async () => {
    const json = await call(faculty, "/api/lectures");
    return `${json.lectures.length} lecture(s)`;
  })();

  // Faculty posts a notice
  const facultyNotice = await step("faculty posts a notice", async () => {
    const json = await call(faculty, "/api/notices", {
      method: "POST",
      body: JSON.stringify({ title: `[func] notice ${Date.now()}`, body: "Hello class" })
    });
    return `id=${json.notice.id.slice(0, 8)}`;
  })();

  // Student sees the notice
  await step("student can read notices", async () => {
    const json = await call(student, "/api/notices");
    return `${json.notices.length} notices`;
  })();

  // Faculty cleans up the notice
  const facultyNotices = await call(faculty, "/api/notices");
  const ownLatest = facultyNotices.notices.find((n) => n.title.startsWith("[func] notice"));
  if (ownLatest) {
    await step("faculty deletes own notice", async () =>
      call(faculty, `/api/notices/${ownLatest.id}`, { method: "DELETE" }).then(() => "ok")
    )();
  }

  // Faculty posts a remark for the canonical seed student profile.
  const studentsJson = await call(admin, "/api/admin/users");
  const studentProfile = studentsJson.profiles.find((p) => p.email === student.email);
  const studentJoin = Array.isArray(studentProfile?.student_profiles)
    ? studentProfile?.student_profiles[0]
    : studentProfile?.student_profiles;
  const sId = studentJoin?.id;
  if (sId) {
    await step("faculty posts remark", async () =>
      call(faculty, "/api/remarks", {
        method: "POST",
        body: JSON.stringify({ studentId: sId, body: `auto-remark ${Date.now()}` })
      }).then((j) => `id=${j.remark.id.slice(0, 8)}`)
    )();

    await step("student sees remark", async () => {
      const json = await call(student, "/api/remarks");
      const has = json.remarks.some((r) => r.body.startsWith("auto-remark"));
      if (!has) throw new Error("remark not visible to student");
      return `${json.remarks.length} remark(s)`;
    })();
  }

  // Chat: faculty starts a direct thread with the seed student.
  await step("faculty opens direct thread with student", async () => {
    const studentUserId = studentProfile?.id;
    if (!studentUserId) throw new Error("no student profile id");
    const json = await call(faculty, "/api/chat/threads", {
      method: "POST",
      body: JSON.stringify({ type: "direct", participantIds: [studentUserId] })
    });
    return `thread=${(json.thread.id ?? "?").slice(0, 8)}`;
  })();

  await step("faculty sends a message in that thread", async () => {
    const threads = await call(faculty, "/api/chat/threads");
    const direct = threads.threads.find((t) => t.type === "direct");
    if (!direct) throw new Error("no direct thread found");
    const msg = await call(faculty, `/api/chat/threads/${direct.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: "hi from faculty (auto)" })
    });
    return `msg=${msg.message.id.slice(0, 8)}`;
  })();

  await step("student sees the new chat message", async () => {
    const threads = await call(student, "/api/chat/threads");
    const direct = threads.threads.find((t) => t.type === "direct");
    if (!direct) throw new Error("student has no direct thread");
    const json = await call(student, `/api/chat/threads/${direct.id}/messages`);
    const has = json.messages.some((m) => m.body === "hi from faculty (auto)");
    if (!has) throw new Error("message not visible to student");
    return `${json.messages.length} message(s)`;
  })();
}

async function reportsCheck() {
  const admin = accounts.find((a) => a.role === "admin");
  await step("admin reports include user/lecture summary", async () => {
    const json = await call(admin, "/api/admin/reports");
    if (typeof json.summary?.users?.total !== "number") throw new Error("missing users.total");
    return `users=${json.summary.users.total}, lectures=${json.summary.lectures.total}`;
  })();
}

async function settingsCheck() {
  const admin = accounts.find((a) => a.role === "admin");
  await step("admin upserts a setting", async () =>
    call(admin, "/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ key: "test_setting", value: { greeting: "hi" } })
    }).then((j) => `key=${j.setting.key}`)
  )();

  await step("admin reads back the setting", async () => {
    const json = await call(admin, "/api/admin/settings");
    const found = json.settings.find((s) => s.key === "test_setting");
    if (!found) throw new Error("setting not found");
    return `value=${JSON.stringify(found.value)}`;
  })();
}

async function main() {
  await loginAll();

  console.log("\n=== Admin lifecycle ===");
  await adminLifecycle();

  console.log("\n=== Faculty / student / chat ===");
  await facultyAndStudent();

  console.log("\n=== Reports ===");
  await reportsCheck();

  console.log("\n=== Settings ===");
  await settingsCheck();

  console.log("\n--- summary ---");
  const failed = log.filter((l) => !l.ok);
  console.log(`Passed: ${log.length - failed.length}/${log.length}`);
  if (failed.length) {
    process.exit(1);
  }
}

await main();
