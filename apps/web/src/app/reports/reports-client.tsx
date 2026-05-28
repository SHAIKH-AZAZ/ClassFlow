"use client";

import { formatBytes, useApiFetch } from "@/components/use-fetch";

type Summary = {
  users: { total: number; admins: number; faculty: number; students: number; active: number };
  lectures: { total: number; upcoming: number; live: number; completed: number };
  attendance: { total: number; present: number; absent: number; late: number; excused: number };
  storage: { recordings: number; recordingBytes: number; resources: number; resourceBytes: number };
  jobs: { queued: number; processing: number; completed: number; failed: number };
};

export function ReportsClient() {
  const { data, error, loading } = useApiFetch<{ summary: Summary }>("/api/admin/reports");
  const summary = data?.summary;

  if (loading) return <p className="muted">Loading reports…</p>;
  if (error) return <p className="form-message error">{error}</p>;
  if (!summary) return <p className="empty">No data.</p>;

  return (
    <>
      <section className="grid stats">
        <article className="card">
          <div className="stat-value">{summary.users.total}</div>
          <div className="muted">Users</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {summary.users.admins} admin · {summary.users.faculty} faculty · {summary.users.students} student · {summary.users.active} active
          </div>
        </article>
        <article className="card">
          <div className="stat-value">{summary.lectures.total}</div>
          <div className="muted">Lectures</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {summary.lectures.upcoming} upcoming · {summary.lectures.live} live · {summary.lectures.completed} done
          </div>
        </article>
        <article className="card">
          <div className="stat-value">{summary.attendance.total}</div>
          <div className="muted">Attendance rows</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {summary.attendance.present} present · {summary.attendance.absent} absent · {summary.attendance.late} late · {summary.attendance.excused} excused
          </div>
        </article>
        <article className="card">
          <div className="stat-value">{formatBytes(summary.storage.recordingBytes + summary.storage.resourceBytes)}</div>
          <div className="muted">Drive storage</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {summary.storage.recordings} recordings · {summary.storage.resources} resources
          </div>
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Recording jobs</h2>
          <table>
            <tbody>
              <tr>
                <td>Queued</td>
                <td>{summary.jobs.queued}</td>
              </tr>
              <tr>
                <td>Processing</td>
                <td>{summary.jobs.processing}</td>
              </tr>
              <tr>
                <td>Completed</td>
                <td>{summary.jobs.completed}</td>
              </tr>
              <tr>
                <td>Failed</td>
                <td>{summary.jobs.failed}</td>
              </tr>
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>Attendance distribution</h2>
          <table>
            <tbody>
              <tr>
                <td>Present</td>
                <td>{summary.attendance.present}</td>
              </tr>
              <tr>
                <td>Absent</td>
                <td>{summary.attendance.absent}</td>
              </tr>
              <tr>
                <td>Late</td>
                <td>{summary.attendance.late}</td>
              </tr>
              <tr>
                <td>Excused</td>
                <td>{summary.attendance.excused}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>
    </>
  );
}
