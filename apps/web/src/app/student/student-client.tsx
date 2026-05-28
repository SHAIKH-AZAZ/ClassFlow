"use client";

import { useMemo, useState } from "react";
import type { AttendanceStatus } from "@zoom-lms/shared";
import { formatBytes, formatDateTime, useApiFetch } from "@/components/use-fetch";

type Lecture = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  groupName: string | null;
  facultyName: string | null;
  zoom: { joinUrl: string; password: string | null } | null;
};

type Recording = {
  id: string;
  lectureId: string | null;
  lectureTitle: string | null;
  lectureStartsAt: string | null;
  groupName: string | null;
  viewUrl: string | null;
  downloadUrl: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type Resource = {
  id: string;
  title: string;
  groupName: string | null;
  kind: string;
  sizeBytes: number;
  viewUrl: string | null;
  downloadUrl: string | null;
  createdAt: string;
};

type AttendanceRow = {
  id: string;
  lectureTitle: string | null;
  lectureStartsAt: string | null;
  durationMinutes: number;
  requiredMinutes: number;
  status: AttendanceStatus;
  source: string;
};

type Notice = {
  id: string;
  title: string;
  body: string;
  authorName: string | null;
  groupName: string | null;
  createdAt: string;
};

type Remark = {
  id: string;
  body: string;
  facultyName: string | null;
  lectureTitle: string | null;
  createdAt: string;
};

const tabs = [
  { id: "schedule", label: "Schedule" },
  { id: "recordings", label: "Recordings" },
  { id: "resources", label: "Resources" },
  { id: "attendance", label: "Attendance" },
  { id: "notices", label: "Notices" },
  { id: "remarks", label: "Remarks" }
] as const;

type TabId = (typeof tabs)[number]["id"];

export function StudentClient() {
  const [tab, setTab] = useState<TabId>("schedule");
  const lectures = useApiFetch<{ lectures: Lecture[] }>("/api/lectures");
  const recordings = useApiFetch<{ recordings: Recording[] }>("/api/recordings");
  const resources = useApiFetch<{ resources: Resource[] }>("/api/resources");
  const attendance = useApiFetch<{ rows: AttendanceRow[] }>("/api/attendance");
  const notices = useApiFetch<{ notices: Notice[] }>("/api/notices");
  const remarks = useApiFetch<{ remarks: Remark[] }>("/api/remarks");

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (lectures.data?.lectures ?? [])
      .filter((l) => new Date(l.endsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [lectures.data]);

  return (
    <>
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "schedule" ? (
        <article className="card">
          <h2>Upcoming lectures</h2>
          {lectures.loading ? <p className="muted">Loading…</p> : null}
          {lectures.error ? <p className="form-message error">{lectures.error}</p> : null}
          {!lectures.loading && upcoming.length === 0 ? <p className="empty">No upcoming lectures.</p> : null}
          {upcoming.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Lecture</th>
                  <th>Group</th>
                  <th>When</th>
                  <th>Status</th>
                  <th>Join</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.title}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {l.facultyName ?? ""}
                      </div>
                    </td>
                    <td>{l.groupName}</td>
                    <td>
                      {formatDateTime(l.startsAt)}
                      <div className="muted" style={{ fontSize: 12 }}>
                        until {formatDateTime(l.endsAt)}
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${l.status === "live" ? "present" : ""}`}>{l.status}</span>
                    </td>
                    <td>
                      {l.zoom?.joinUrl ? (
                        <a className="button small" href={l.zoom.joinUrl} target="_blank" rel="noreferrer">
                          Join Zoom
                        </a>
                      ) : (
                        <span className="muted">No link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </article>
      ) : null}

      {tab === "recordings" ? (
        <article className="card">
          <h2>Recordings</h2>
          {recordings.loading ? <p className="muted">Loading…</p> : null}
          {!recordings.loading && (recordings.data?.recordings ?? []).length === 0 ? (
            <p className="empty">No recordings yet.</p>
          ) : null}
          <div className="list">
            {(recordings.data?.recordings ?? []).map((r) => (
              <div key={r.id} className="list-item">
                <div>
                  <strong>{r.lectureTitle ?? "Recording"}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.groupName ?? ""} · {formatDateTime(r.createdAt)} · {formatBytes(r.sizeBytes ?? 0)}
                  </div>
                </div>
                <div className="actions">
                  {r.viewUrl ? (
                    <a className="button small" href={r.viewUrl} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {tab === "resources" ? (
        <article className="card">
          <h2>Resources</h2>
          {resources.loading ? <p className="muted">Loading…</p> : null}
          {!resources.loading && (resources.data?.resources ?? []).length === 0 ? (
            <p className="empty">No resources shared.</p>
          ) : null}
          <div className="list">
            {(resources.data?.resources ?? []).map((r) => (
              <div key={r.id} className="list-item">
                <div>
                  <strong>{r.title}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.groupName ?? ""} · {r.kind} · {formatBytes(r.sizeBytes)}
                  </div>
                </div>
                {r.viewUrl ? (
                  <a className="button small" href={r.viewUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {tab === "attendance" ? (
        <article className="card">
          <h2>Attendance</h2>
          {attendance.loading ? <p className="muted">Loading…</p> : null}
          {!attendance.loading && (attendance.data?.rows ?? []).length === 0 ? (
            <p className="empty">No attendance recorded.</p>
          ) : null}
          {(attendance.data?.rows ?? []).length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Lecture</th>
                  <th>When</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(attendance.data?.rows ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.lectureTitle}</td>
                    <td>{formatDateTime(row.lectureStartsAt)}</td>
                    <td>
                      {row.durationMinutes.toFixed(0)} / {row.requiredMinutes.toFixed(0)} min
                    </td>
                    <td>
                      <span className={`chip ${row.status}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </article>
      ) : null}

      {tab === "notices" ? (
        <article className="card">
          <h2>Notices</h2>
          {notices.loading ? <p className="muted">Loading…</p> : null}
          {!notices.loading && (notices.data?.notices ?? []).length === 0 ? (
            <p className="empty">No notices.</p>
          ) : null}
          <div className="list">
            {(notices.data?.notices ?? []).map((n) => (
              <div key={n.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <strong>{n.title}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {n.groupName ? `${n.groupName} · ` : "Institute-wide · "}
                  {n.authorName ?? "Admin"} · {formatDateTime(n.createdAt)}
                </div>
                <p style={{ margin: 0 }}>{n.body}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {tab === "remarks" ? (
        <article className="card">
          <h2>Remarks</h2>
          {remarks.loading ? <p className="muted">Loading…</p> : null}
          {!remarks.loading && (remarks.data?.remarks ?? []).length === 0 ? (
            <p className="empty">No remarks for you.</p>
          ) : null}
          <div className="list">
            {(remarks.data?.remarks ?? []).map((r) => (
              <div key={r.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {formatDateTime(r.createdAt)} · {r.facultyName ?? "Admin"}
                  {r.lectureTitle ? ` · ${r.lectureTitle}` : ""}
                </div>
                <div>{r.body}</div>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </>
  );
}
