import { AppShell } from "@/components/app-shell";

const reports = [
  ["Attendance report", "Zoom duration threshold plus faculty overrides"],
  ["Meeting history", "Lecture schedule, start links, join links, recordings"],
  ["Storage status", "Drive folders, resource metadata, recording uploads"],
  ["System logs", "Admin, integration, webhook, and worker events"]
];

export default function ReportsPage() {
  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Reports</p>
          <h1>Export-ready institute records</h1>
          <p className="muted">Reports should be filtered by group, lecture date range, faculty, and attendance status.</p>
        </div>
      </div>

      <article className="card">
        <table>
          <thead>
            <tr>
              <th>Report</th>
              <th>Data source</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(([name, source]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="muted">{source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </AppShell>
  );
}
