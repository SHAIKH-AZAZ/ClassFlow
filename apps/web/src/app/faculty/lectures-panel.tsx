"use client";

import { FormEvent, useState } from "react";
import type { LectureStatus } from "@zoom-lms/shared";
import { lectureStatuses } from "@zoom-lms/shared";
import { apiCall, formatDateTime, useApiFetch } from "@/components/use-fetch";
import type { FacultyOption, GroupOption } from "./faculty-client";

type Lecture = {
  id: string;
  title: string;
  description: string | null;
  groupId: string;
  facultyId: string;
  startsAt: string;
  endsAt: string;
  status: LectureStatus;
  attendanceThresholdPercent: number;
  groupName: string | null;
  groupCode: string | null;
  facultyName: string | null;
  zoom: { joinUrl: string; startUrl: string | null; password: string | null; zoomMeetingId: string } | null;
};

function defaultStart() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now.toISOString().slice(0, 16);
}

function defaultEnd() {
  const start = new Date(defaultStart());
  start.setHours(start.getHours() + 1);
  return start.toISOString().slice(0, 16);
}

export function LecturesPanel({
  role,
  facultyProfileId,
  groups,
  faculties
}: {
  role: "admin" | "faculty";
  facultyProfileId: string | null;
  groups: GroupOption[];
  faculties: FacultyOption[];
}) {
  const { data, loading, error, reload } = useApiFetch<{ lectures: Lecture[] }>("/api/lectures");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    groupId: groups[0]?.id ?? "",
    facultyId: role === "faculty" ? facultyProfileId ?? "" : faculties[0]?.id ?? "",
    startsAt: defaultStart(),
    endsAt: defaultEnd(),
    threshold: "70"
  });

  async function createLecture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const startsAt = new Date(form.startsAt).toISOString();
      const endsAt = new Date(form.endsAt).toISOString();
      await apiCall("/api/lectures", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          groupId: form.groupId,
          facultyId: form.facultyId,
          startsAt,
          endsAt,
          attendanceThresholdPercent: Number(form.threshold)
        })
      });
      setMessage({ kind: "success", text: "Lecture scheduled and Zoom meeting created." });
      setForm({ ...form, title: "", description: "" });
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(lecture: Lecture, status: LectureStatus) {
    try {
      await apiCall(`/api/lectures/${lecture.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function syncAttendance(lecture: Lecture) {
    if (!window.confirm(`Sync attendance from Zoom for "${lecture.title}"?`)) return;
    try {
      const resp = await apiCall<{ synced: number }>("/api/attendance/sync", {
        method: "POST",
        body: JSON.stringify({ lectureId: lecture.id })
      });
      alert(`Synced ${resp.synced} attendance rows.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function remove(lecture: Lecture) {
    if (!window.confirm(`Delete lecture "${lecture.title}"? This removes the Zoom meeting record too.`)) return;
    try {
      await apiCall(`/api/lectures/${lecture.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => alert("Copied to clipboard."),
      () => alert("Copy failed.")
    );
  }

  const lectures = data?.lectures ?? [];

  return (
    <section className="grid two">
      <article className="card">
        <h2>Schedule lecture</h2>
        <form className="form" onSubmit={createLecture}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="form-row">
            <label>
              Group
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} required>
                <option value="">Select…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Faculty
              <select
                value={form.facultyId}
                onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
                disabled={role === "faculty"}
                required
              >
                <option value="">Select…</option>
                {(role === "faculty" && facultyProfileId
                  ? faculties.filter((f) => f.id === facultyProfileId)
                  : faculties
                ).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fullName}
                    {f.zoomHostUserId ? "" : " · no Zoom host"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Starts
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required />
            </label>
            <label>
              Ends
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} required />
            </label>
            <label>
              Attendance threshold (%)
              <input
                type="number"
                min={0}
                max={100}
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                required
              />
            </label>
          </div>
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Scheduling..." : "Schedule lecture"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>
      </article>

      <article className="card">
        <h2>Your lectures</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && lectures.length === 0 ? <p className="empty">No lectures yet.</p> : null}

        {lectures.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Lecture</th>
                <th>Group</th>
                <th>When</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map((lecture) => (
                <tr key={lecture.id}>
                  <td>
                    <strong>{lecture.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {lecture.description ?? ""}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      ID <span className="kbd">{lecture.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td>
                    {lecture.groupName} ({lecture.groupCode})
                  </td>
                  <td>
                    {formatDateTime(lecture.startsAt)}
                    <div className="muted" style={{ fontSize: 12 }}>
                      until {formatDateTime(lecture.endsAt)}
                    </div>
                  </td>
                  <td>
                    <select
                      value={lecture.status}
                      onChange={(e) => changeStatus(lecture, e.target.value as LectureStatus)}
                    >
                      {lectureStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="actions">
                      {lecture.zoom?.startUrl ? (
                        <a className="button small" href={lecture.zoom.startUrl} target="_blank" rel="noreferrer">
                          Start
                        </a>
                      ) : null}
                      {lecture.zoom?.joinUrl ? (
                        <button className="button small ghost" type="button" onClick={() => copy(lecture.zoom!.joinUrl)}>
                          Copy join link
                        </button>
                      ) : null}
                      <button className="button small ghost" type="button" onClick={() => syncAttendance(lecture)}>
                        Sync attendance
                      </button>
                      <button className="button small danger" type="button" onClick={() => remove(lecture)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
