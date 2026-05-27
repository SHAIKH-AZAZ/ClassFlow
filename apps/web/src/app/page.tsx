import { lectureStatuses } from "@zoom-lms/shared";
import { AppShell } from "@/components/app-shell";

const stats = [
  ["Active students", "428"],
  ["Faculty hosts", "32"],
  ["Groups", "18"],
  ["Attendance avg.", "84%"]
];

const lectures = [
  ["Data Structures", "CS-A", "10:00 AM", "scheduled"],
  ["Financial Accounting", "BCom-2", "11:30 AM", "scheduled"],
  ["Thermodynamics", "ME-3", "2:00 PM", "live"]
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Single institute workspace</p>
          <h1>Classes, attendance, recordings, and resources</h1>
          <p className="muted">Supabase Auth and PostgreSQL drive role access across web and mobile.</p>
        </div>
        <a className="button" href="/faculty">Schedule lecture</a>
      </div>

      <section className="grid stats" aria-label="Overview">
        {stats.map(([label, value]) => (
          <article className="card" key={label}>
            <div className="stat-value">{value}</div>
            <div className="muted">{label}</div>
          </article>
        ))}
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Today&apos;s Lectures</h2>
          <table>
            <thead>
              <tr>
                <th>Lecture</th>
                <th>Group</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map(([title, group, time, status]) => (
                <tr key={title}>
                  <td>{title}</td>
                  <td>{group}</td>
                  <td>{time}</td>
                  <td>
                    <span className={`badge ${status === "live" ? "live" : ""}`}>{status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2>Delivery Phases</h2>
          <div className="timeline">
            {[
              "Auth, roles, users, groups",
              "Lecture scheduling and Zoom creation",
              "Attendance sync and correction",
              "Drive uploads and recording worker",
              "Realtime chat, notices, remarks"
            ].map((phase, index) => (
              <div className="timeline-item" key={phase}>
                <strong>Phase {index + 1}</strong>
                <div className="muted">{phase}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <p className="muted" style={{ marginTop: 16 }}>
        Supported lecture states: {lectureStatuses.join(", ")}.
      </p>
    </AppShell>
  );
}
