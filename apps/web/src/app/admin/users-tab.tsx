"use client";

import { FormEvent, useState } from "react";
import { roles } from "@zoom-lms/shared";
import { confirmAction } from "@/components/confirm-dialog";
import { apiCall, firstRel, formatDate, useApiFetch } from "@/components/use-fetch";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string;
  role: "admin" | "faculty" | "student";
  active: boolean;
  phone: string | null;
  created_at: string;
  faculty_profiles?:
    | { id: string; employee_code: string | null; department: string | null; zoom_host_user_id: string | null }
    | { id: string; employee_code: string | null; department: string | null; zoom_host_user_id: string | null }[]
    | null;
  student_profiles?:
    | { id: string; roll_number: string | null; guardian_phone: string | null }
    | { id: string; roll_number: string | null; guardian_phone: string | null }[]
    | null;
};

const initialFormState = {
  role: "student",
  email: "",
  password: "",
  fullName: "",
  phone: "",
  employeeCode: "",
  department: "",
  zoomHostUserId: "",
  rollNumber: "",
  guardianPhone: ""
};

export function UsersTab() {
  const { data, error, loading, reload } = useApiFetch<{ profiles: AdminUser[] }>("/api/admin/users");
  const [form, setForm] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "faculty" | "student">("all");
  const [search, setSearch] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await apiCall("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          role: form.role,
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone || undefined,
          employeeCode: form.employeeCode || undefined,
          department: form.department || undefined,
          zoomHostUserId: form.zoomHostUserId || undefined,
          rollNumber: form.rollNumber || undefined,
          guardianPhone: form.guardianPhone || undefined
        })
      });
      setMessage({ kind: "success", text: "User created." });
      setForm(initialFormState);
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed to create user." });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    try {
      await apiCall(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active })
      });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user.");
    }
  }

  async function resetPassword(user: AdminUser) {
    const password = window.prompt(`Set a new password for ${user.email ?? user.full_name}:`);
    if (!password) return;
    try {
      await apiCall(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password })
      });
      alert("Password updated.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update password.");
    }
  }

  async function setZoomHost(user: AdminUser) {
    if (user.role !== "faculty") return;
    const current = firstRel(user.faculty_profiles)?.zoom_host_user_id ?? "";
    const value = window.prompt("Zoom host user id (email or Zoom user id):", current);
    if (value === null) return;
    try {
      await apiCall(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ zoomHostUserId: value || null })
      });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update host.");
    }
  }

  async function remove(user: AdminUser) {
    const ok = await confirmAction({
      title: `Delete ${user.full_name}?`,
      description: (
        <>
          This permanently removes the auth user, profile, and any role-specific records.
          <br />
          <strong>{user.email ?? user.full_name}</strong> · role <strong>{user.role}</strong>
        </>
      ),
      confirmLabel: "Delete user",
      variant: "danger",
      requireTextMatch: user.full_name
    });
    if (!ok) return;
    try {
      await apiCall(`/api/admin/users/${user.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  const profiles = data?.profiles ?? [];
  const filtered = profiles.filter((p) => {
    if (filterRole !== "all" && p.role !== filterRole) return false;
    if (search && !`${p.full_name} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      <article className="card">
        <h2>Create user</h2>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-row">
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Full name
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Password
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </label>
          </div>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>

          {form.role === "faculty" ? (
            <div className="form-row">
              <label>
                Employee code
                <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
              </label>
              <label>
                Department
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </label>
              <label>
                Zoom host id (email)
                <input value={form.zoomHostUserId} onChange={(e) => setForm({ ...form, zoomHostUserId: e.target.value })} />
              </label>
            </div>
          ) : null}

          {form.role === "student" ? (
            <div className="form-row">
              <label>
                Roll number
                <input value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
              </label>
              <label>
                Guardian phone
                <input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
              </label>
            </div>
          ) : null}

          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create user"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>
      </article>

      <article className="card">
        <h2>Users</h2>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label>
            Role filter
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}>
              <option value="all">All</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="name or email" />
          </label>
        </div>

        {loading ? <p className="muted">Loading users...</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && filtered.length === 0 ? <p className="empty">No users match.</p> : null}

        {filtered.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const facultyRel = firstRel(user.faculty_profiles);
                  const studentRel = firstRel(user.student_profiles);
                  const facultyId = facultyRel?.id;
                  const studentRoll = studentRel?.roll_number;
                  const zoomHost = facultyRel?.zoom_host_user_id;
                  return (
                    <tr key={user.id}>
                      <td>
                        {user.full_name}
                        {user.role === "faculty" && zoomHost ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            Zoom: {zoomHost}
                          </div>
                        ) : null}
                        {user.role === "faculty" && !zoomHost ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            No Zoom host
                          </div>
                        ) : null}
                        {studentRoll ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            Roll: {studentRoll}
                          </div>
                        ) : null}
                        {facultyId ? (
                          <div className="muted" style={{ fontSize: 11 }}>
                            ID: <span className="kbd">{facultyId.slice(0, 8)}</span>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className="chip">{user.role}</span>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.active ? "Active" : "Disabled"}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div className="actions">
                          <button className="button small ghost" onClick={() => toggleActive(user)} type="button">
                            {user.active ? "Disable" : "Enable"}
                          </button>
                          <button className="button small ghost" onClick={() => resetPassword(user)} type="button">
                            Password
                          </button>
                          {user.role === "faculty" ? (
                            <button className="button small ghost" onClick={() => setZoomHost(user)} type="button">
                              Zoom host
                            </button>
                          ) : null}
                          <button className="button small danger" onClick={() => remove(user)} type="button">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </div>
  );
}
