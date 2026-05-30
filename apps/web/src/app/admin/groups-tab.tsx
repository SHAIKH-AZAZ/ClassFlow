"use client";

import { FormEvent, useState } from "react";
import { apiCall, firstRel, useApiFetch } from "@/components/use-fetch";
import { confirmAction } from "@/components/confirm-dialog";

type Group = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  studentCount: number;
};

type StudentOption = {
  id: string;
  email: string | null;
  full_name: string;
  role: "admin" | "faculty" | "student";
  student_profiles?:
    | { id: string; roll_number: string | null }
    | { id: string; roll_number: string | null }[]
    | null;
};

type EnrollmentRow = {
  student_id: string;
  student_profiles:
    | {
        id: string;
        roll_number: string | null;
        profiles: { id: string; email: string | null; full_name: string };
      }
    | {
        id: string;
        roll_number: string | null;
        profiles: { id: string; email: string | null; full_name: string };
      }[]
    | null;
};

export function GroupsTab() {
  const { data: groupsData, loading, error, reload } = useApiFetch<{ groups: Group[] }>("/api/admin/groups");
  const { data: usersData } = useApiFetch<{ profiles: StudentOption[] }>("/api/admin/users");
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await apiCall("/api/admin/groups", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ name: "", code: "", description: "" });
      reload();
      setMessage({ kind: "success", text: "Group created." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(group: Group) {
    try {
      await apiCall(`/api/admin/groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !group.active })
      });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function remove(group: Group) {
    const ok = await confirmAction({
      title: `Delete group ${group.name}?`,
      description: (
        <>
          Lectures and resources tied to this group remain, but every enrollment is removed and
          chat threads scoped to it are deleted.
          <br />
          <strong>{group.name}</strong> · code <span className="kbd">{group.code}</span> · {group.studentCount} student(s)
        </>
      ),
      confirmLabel: "Delete group",
      variant: "danger",
      requireTextMatch: group.code
    });
    if (!ok) return;
    try {
      await apiCall(`/api/admin/groups/${group.id}`, { method: "DELETE" });
      if (selectedId === group.id) setSelectedId(null);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  const groups = groupsData?.groups ?? [];
  const selected = groups.find((g) => g.id === selectedId) ?? null;

  return (
    <section className="grid" style={{ gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)", gap: 16 }}>
      <article className="card">
        <h2>Create group</h2>
        <form className="form" onSubmit={createGroup}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Code
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create group"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>

        <h2 style={{ marginTop: 24 }}>Groups</h2>
        {loading ? <p className="muted">Loading...</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && groups.length === 0 ? <p className="empty">No groups yet.</p> : null}
        <div className="list">
          {groups.map((group) => (
            <div key={group.id} className="list-item">
              <div>
                <strong>{group.name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {group.code} · {group.studentCount} students {group.active ? "" : "· disabled"}
                </div>
                {group.description ? <div className="muted" style={{ fontSize: 12 }}>{group.description}</div> : null}
              </div>
              <div className="actions">
                <button className="button small ghost" type="button" onClick={() => setSelectedId(group.id)}>
                  Manage
                </button>
                <button className="button small ghost" type="button" onClick={() => toggleActive(group)}>
                  {group.active ? "Disable" : "Enable"}
                </button>
                <button className="button small danger" type="button" onClick={() => remove(group)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2>Manage enrollment</h2>
        {selected ? (
          <EnrollmentPanel group={selected} students={usersData?.profiles ?? []} onChanged={reload} />
        ) : (
          <p className="muted">Pick a group to manage enrollments.</p>
        )}
      </article>
    </section>
  );
}

function EnrollmentPanel({
  group,
  students,
  onChanged
}: {
  group: Group;
  students: StudentOption[];
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useApiFetch<{ enrollments: EnrollmentRow[] }>(
    `/api/admin/groups/${group.id}/students`,
    [group.id]
  );
  const [studentId, setStudentId] = useState("");

  const studentOptions = students
    .filter((s) => s.role === "student" && firstRel(s.student_profiles))
    .map((s) => {
      const sp = firstRel(s.student_profiles)!;
      return { id: sp.id, fullName: s.full_name, rollNumber: sp.roll_number, email: s.email };
    });

  async function add() {
    if (!studentId) return;
    try {
      await apiCall(`/api/admin/groups/${group.id}/students`, {
        method: "POST",
        body: JSON.stringify({ studentId })
      });
      setStudentId("");
      reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function remove(rowStudentId: string) {
    const ok = await confirmAction({
      title: "Remove student from group?",
      description: "The student will lose access to lectures, recordings, resources, and notices for this group. Their account stays intact.",
      confirmLabel: "Remove",
      variant: "danger"
    });
    if (!ok) return;
    try {
      await apiCall(`/api/admin/groups/${group.id}/students?studentId=${rowStudentId}`, { method: "DELETE" });
      reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {group.name} · <span className="kbd">{group.code}</span>
      </p>

      <div className="form-row" style={{ marginBottom: 12 }}>
        <label>
          Add student
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select student…</option>
            {studentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.fullName}
                {option.rollNumber ? ` (${option.rollNumber})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="button" type="button" disabled={!studentId} onClick={add}>
            Add
          </button>
        </div>
      </div>

      {loading ? <p className="muted">Loading enrollments...</p> : null}
      {error ? <p className="form-message error">{error}</p> : null}
      {data?.enrollments?.length === 0 ? <p className="empty">No students enrolled.</p> : null}

      {data?.enrollments && data.enrollments.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((row) => {
                const sp = firstRel(row.student_profiles);
                const profile = firstRel(sp?.profiles);
                return (
                  <tr key={row.student_id}>
                    <td>{profile?.full_name ?? "Unknown"}</td>
                    <td>{sp?.roll_number ?? "-"}</td>
                    <td>{profile?.email ?? "-"}</td>
                    <td>
                      <button className="button small danger" type="button" onClick={() => remove(row.student_id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
