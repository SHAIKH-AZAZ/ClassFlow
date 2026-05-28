"use client";

import { useState } from "react";
import type { AttendanceStatus } from "@zoom-lms/shared";
import { attendanceStatuses } from "@zoom-lms/shared";
import { apiCall, formatDateTime, useApiFetch } from "@/components/use-fetch";

type Lecture = { id: string; title: string; startsAt: string; groupName: string | null };
type Row = {
  id: string;
  lectureId: string;
  studentId: string;
  durationMinutes: number;
  requiredMinutes: number;
  status: AttendanceStatus;
  source: string;
  studentName: string | null;
  rollNumber: string | null;
  studentEmail: string | null;
  lectureTitle: string | null;
};

export function AttendancePanel() {
  const { data: lecturesData } = useApiFetch<{ lectures: Lecture[] }>("/api/lectures");
  const [lectureId, setLectureId] = useState("");
  const { data, loading, error, reload } = useApiFetch<{ rows: Row[] }>(
    lectureId ? `/api/attendance?lectureId=${lectureId}` : "/api/attendance",
    [lectureId]
  );
  const [busy, setBusy] = useState(false);

  async function syncAttendance() {
    if (!lectureId) return;
    if (!window.confirm("Pull participant durations from Zoom and upsert attendance rows?")) return;
    setBusy(true);
    try {
      const resp = await apiCall<{ synced: number }>("/api/attendance/sync", {
        method: "POST",
        body: JSON.stringify({ lectureId })
      });
      alert(`Synced ${resp.synced} rows.`);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function override(row: Row, status: AttendanceStatus) {
    if (status === row.status) return;
    const reason = window.prompt("Reason for the correction:");
    if (!reason) return;
    try {
      await apiCall("/api/attendance/override", {
        method: "POST",
        body: JSON.stringify({ attendanceId: row.id, status, reason })
      });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  const lectures = lecturesData?.lectures ?? [];
  const rows = data?.rows ?? [];

  return (
    <article className="card">
      <h2>Attendance</h2>
      <div className="form-row" style={{ marginBottom: 12 }}>
        <label>
          Lecture
          <select value={lectureId} onChange={(e) => setLectureId(e.target.value)}>
            <option value="">All my lectures</option>
            {lectures.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} · {l.groupName} · {formatDateTime(l.startsAt)}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="button" disabled={!lectureId || busy} onClick={syncAttendance} type="button">
            {busy ? "Syncing…" : "Sync from Zoom"}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="form-message error">{error}</p> : null}
      {!loading && rows.length === 0 ? <p className="empty">No attendance rows.</p> : null}

      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Lecture</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Override</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.studentName ?? "Unknown"}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {row.rollNumber ?? ""} · {row.studentEmail ?? ""}
                  </div>
                </td>
                <td>{row.lectureTitle}</td>
                <td>
                  {row.durationMinutes.toFixed(0)} / {row.requiredMinutes.toFixed(0)} min
                </td>
                <td>
                  <span className={`chip ${row.status}`}>{row.status}</span>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {row.source}
                  </div>
                </td>
                <td>
                  <select value={row.status} onChange={(e) => override(row, e.target.value as AttendanceStatus)}>
                    {attendanceStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}
