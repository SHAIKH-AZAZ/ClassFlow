import { AppShell } from "@/components/app-shell";

const rows = [
  ["Faculty", "Create host profiles, map Zoom users, assign groups"],
  ["Students", "Invite Gmail users, enable OTP login, enroll in groups"],
  ["Groups", "Manage class batches and app-level file access"],
  ["Permissions", "Admin, faculty, and student role boundaries"]
];

export default function AdminPage() {
  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Users, groups, and permissions</h1>
          <p className="muted">Supabase Auth owns identity; profile tables own institute roles and enrollment.</p>
        </div>
        <a className="button" href="/api/auth/session">
          Check session
        </a>
      </div>

      <article className="card">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([area, scope]) => (
              <tr key={area}>
                <td>{area}</td>
                <td className="muted">{scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </AppShell>
  );
}
