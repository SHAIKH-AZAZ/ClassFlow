"use client";

import { FormEvent, useState } from "react";
import { apiCall, firstRel, formatDateTime, useApiFetch } from "@/components/use-fetch";

type Remark = {
  id: string;
  studentId: string;
  studentName: string | null;
  rollNumber: string | null;
  facultyName: string | null;
  body: string;
  lectureTitle: string | null;
  lectureId: string | null;
  createdAt: string;
};

type Lecture = { id: string; title: string };
type Student = {
  id: string;
  full_name: string;
  role: string;
  student_profiles?:
    | { id: string; roll_number: string | null }
    | { id: string; roll_number: string | null }[]
    | null;
};

export function RemarksPanel() {
  const { data: lecturesData } = useApiFetch<{ lectures: Lecture[] }>("/api/lectures");
  const { data: studentsData } = useApiFetch<{ profiles: Student[] }>("/api/admin/users");
  const { data, loading, error, reload } = useApiFetch<{ remarks: Remark[] }>("/api/remarks");

  const [form, setForm] = useState({ studentId: "", lectureId: "", body: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.studentId || !form.body.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await apiCall("/api/remarks", {
        method: "POST",
        body: JSON.stringify({ studentId: form.studentId, lectureId: form.lectureId || null, body: form.body })
      });
      setMessage({ kind: "success", text: "Remark posted." });
      setForm({ studentId: "", lectureId: "", body: "" });
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSubmitting(false);
    }
  }

  const studentOptions = (studentsData?.profiles ?? [])
    .map((u) => ({ user: u, sp: firstRel(u.student_profiles) }))
    .filter(({ user, sp }) => user.role === "student" && sp)
    .map(({ user, sp }) => ({ id: sp!.id, name: user.full_name, roll: sp!.roll_number }));

  const remarks = data?.remarks ?? [];

  return (
    <section className="grid two">
      <article className="card">
        <h2>Add remark</h2>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Student
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
              <option value="">Select student…</option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.roll ? `(${s.roll})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lecture (optional)
            <select value={form.lectureId} onChange={(e) => setForm({ ...form, lectureId: e.target.value })}>
              <option value="">No lecture</option>
              {(lecturesData?.lectures ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Body
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          </label>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Post remark"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>
      </article>

      <article className="card">
        <h2>Recent remarks</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && remarks.length === 0 ? <p className="empty">No remarks yet.</p> : null}
        <div className="list">
          {remarks.map((r) => (
            <div key={r.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {formatDateTime(r.createdAt)} · {r.facultyName ?? "Admin"} → {r.studentName ?? "Student"}
                {r.lectureTitle ? ` · ${r.lectureTitle}` : ""}
              </div>
              <div>{r.body}</div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
