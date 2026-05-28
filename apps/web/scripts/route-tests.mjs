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

const BASE = process.env.BASE ?? "http://localhost:3001";

const accounts = [
  { role: "admin", email: "admin@example.com", password: env.ADMIN_PASSWORD ?? "Admin@123" },
  { role: "faculty", email: "faculty@example.com", password: env.FACULTY_PASSWORD ?? "Faculty@123" },
  { role: "student", email: "student@example.com", password: env.STUDENT_PASSWORD ?? "Student@123" }
];

const results = [];

function record(role, name, expected, actualStatus, extra = "") {
  const ok = Array.isArray(expected) ? expected.includes(actualStatus) : actualStatus === expected;
  results.push({ role, name, expected: Array.isArray(expected) ? expected.join("/") : expected, actual: actualStatus, ok, extra });
  const icon = ok ? "✅" : "❌";
  const tail = extra ? ` ${extra}` : "";
  console.log(`${icon} [${role}] ${name} → ${actualStatus} (expected ${Array.isArray(expected) ? expected.join("/") : expected})${tail}`);
}

function parseSetCookies(headers) {
  // Headers.getSetCookie is not always available — gather via raw entries.
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const result = [];
  for (const [k, v] of headers) {
    if (k.toLowerCase() === "set-cookie") result.push(v);
  }
  return result;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function applySetCookies(jar, setCookies) {
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (value === "" && /max-age=0/i.test(sc)) {
      delete jar[name];
    } else {
      jar[name] = value;
    }
  }
}

async function loginAll() {
  for (const account of accounts) {
    account.cookies = {};
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${account.role} login failed: ${res.status} ${text}`);
    }
    applySetCookies(account.cookies, parseSetCookies(res.headers));
    console.log(`🔑 ${account.role} logged in (cookies: ${Object.keys(account.cookies).length})`);
  }
}

async function fetchAs(account, path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (account?.cookies && Object.keys(account.cookies).length) {
    headers.set("cookie", cookieHeader(account.cookies));
  }
  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  // Turbopack first-compile occasionally races the React Client Manifest in dev.
  // Retry transient 500s with a back-off so the assertions get a real result.
  let res;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    if (res.status !== 500) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  applySetCookies(account.cookies, parseSetCookies(res.headers));
  return res;
}

async function warmup(authedAccount) {
  // First-touch every protected page as an authed user so Turbopack actually
  // compiles them. Anonymous requests are redirected before pages are bundled.
  const paths = ["/admin", "/faculty", "/student", "/notices", "/chat", "/reports", "/settings"];
  for (const p of paths) {
    await fetchAs(authedAccount, p).catch(() => null);
  }
}

async function testSession(account) {
  const r = await fetchAs(account, "/api/auth/session");
  record(account.role, "GET /api/auth/session", 200, r.status);
  if (r.ok) {
    const json = await r.json();
    if (json.profile?.role !== account.role) {
      record(account.role, "session role match", account.role, json.profile?.role ?? "missing");
    } else {
      record(account.role, "session role match", account.role, json.profile.role);
    }
  }
}

async function testPageGuards(account) {
  const checks = [
    { path: "/admin", allowedRoles: ["admin"] },
    { path: "/faculty", allowedRoles: ["admin", "faculty"] },
    { path: "/student", allowedRoles: ["admin", "student"] },
    { path: "/notices", allowedRoles: ["admin", "faculty", "student"] },
    { path: "/chat", allowedRoles: ["admin", "faculty", "student"] },
    { path: "/reports", allowedRoles: ["admin", "faculty"] },
    { path: "/settings", allowedRoles: ["admin"] }
  ];
  for (const c of checks) {
    const r = await fetchAs(account, c.path);
    const allowed = c.allowedRoles.includes(account.role);
    const expectedStatuses = allowed ? [200, 307, 308] : [307, 308];
    const location = r.headers.get("location") ?? "";
    record(account.role, `GET ${c.path}`, expectedStatuses, r.status, location ? `→ ${location}` : "");
    if (!allowed && r.status >= 300 && r.status < 400) {
      // confirm not redirecting to the protected page itself
      if (location && location.startsWith(c.path)) {
        record(account.role, `redirect target for ${c.path}`, "non-self", "self", `(${location})`);
      }
    }
  }
}

async function testAdminApis(account) {
  const expectAuthorized = account.role === "admin";

  const usersResp = await fetchAs(account, "/api/admin/users");
  record(account.role, "GET /api/admin/users", expectAuthorized ? 200 : 403, usersResp.status);

  const groupsResp = await fetchAs(account, "/api/admin/groups");
  record(account.role, "GET /api/admin/groups", expectAuthorized ? 200 : 403, groupsResp.status);

  const reportsResp = await fetchAs(account, "/api/admin/reports");
  record(account.role, "GET /api/admin/reports", account.role === "student" ? 403 : 200, reportsResp.status);

  const settingsResp = await fetchAs(account, "/api/admin/settings");
  record(account.role, "GET /api/admin/settings", expectAuthorized ? 200 : 403, settingsResp.status);
}

async function testLectureApis(account) {
  const list = await fetchAs(account, "/api/lectures");
  record(account.role, "GET /api/lectures", 200, list.status);

  if (account.role === "student") {
    const create = await fetchAs(account, "/api/lectures", {
      method: "POST",
      body: JSON.stringify({ title: "x", groupId: "x", facultyId: "x", startsAt: new Date().toISOString(), endsAt: new Date().toISOString() })
    });
    record(account.role, "POST /api/lectures (forbidden)", 403, create.status);
    return;
  }
}

async function testRoleSpecific(account) {
  // Notices
  const list = await fetchAs(account, "/api/notices");
  record(account.role, "GET /api/notices", 200, list.status);

  const create = await fetchAs(account, "/api/notices", {
    method: "POST",
    body: JSON.stringify({ title: `[Test] ${account.role}`, body: "Hello" })
  });
  if (account.role === "student") {
    record(account.role, "POST /api/notices (forbidden)", 403, create.status);
  } else {
    record(account.role, "POST /api/notices", 200, create.status);
    if (create.status === 200) {
      const created = await create.json();
      const del = await fetchAs(account, `/api/notices/${created.notice.id}`, { method: "DELETE" });
      record(account.role, "DELETE /api/notices/:id (own)", 200, del.status);
    }
  }

  // Resources / Recordings list
  const resourcesList = await fetchAs(account, "/api/resources");
  record(account.role, "GET /api/resources", 200, resourcesList.status);

  const recordingsList = await fetchAs(account, "/api/recordings");
  record(account.role, "GET /api/recordings", 200, recordingsList.status);

  // Attendance
  const attendance = await fetchAs(account, "/api/attendance");
  record(account.role, "GET /api/attendance", 200, attendance.status);

  // Remarks
  const remarksList = await fetchAs(account, "/api/remarks");
  record(account.role, "GET /api/remarks", 200, remarksList.status);

  if (account.role === "student") {
    const r = await fetchAs(account, "/api/remarks", {
      method: "POST",
      body: JSON.stringify({ studentId: "x", body: "x" })
    });
    record(account.role, "POST /api/remarks (forbidden)", 403, r.status);
  }

  // Chat threads
  const threads = await fetchAs(account, "/api/chat/threads");
  record(account.role, "GET /api/chat/threads", 200, threads.status);
}

async function testUnauthenticated() {
  console.log("\n=== UNAUTHENTICATED ===");
  const probes = [
    { path: "/admin", expected: [307, 308] },
    { path: "/faculty", expected: [307, 308] },
    { path: "/student", expected: [307, 308] },
    { path: "/api/admin/users", expected: 401 },
    { path: "/api/lectures", expected: 401 },
    { path: "/api/auth/session", expected: 401 }
  ];
  for (const p of probes) {
    const r = await fetch(`${BASE}${p.path}`, { redirect: "manual" });
    const location = r.headers.get("location") ?? "";
    record("anon", `${p.path}`, p.expected, r.status, location ? `→ ${location}` : "");
  }
}

async function main() {
  await loginAll();
  // Warm up as the admin (only role allowed on every page).
  const adminAccount = accounts.find((a) => a.role === "admin");
  if (adminAccount) await warmup(adminAccount);

  for (const account of accounts) {
    console.log(`\n=== ${account.role.toUpperCase()} ===`);
    await testSession(account);
    await testPageGuards(account);
    await testAdminApis(account);
    await testLectureApis(account);
    await testRoleSpecific(account);
  }

  await testUnauthenticated();

  console.log("\n--- summary ---");
  const failed = results.filter((r) => !r.ok);
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) {
      console.log(`  [${f.role}] ${f.name} → ${f.actual} (expected ${f.expected}) ${f.extra}`);
    }
    process.exit(1);
  }
}

await main();
