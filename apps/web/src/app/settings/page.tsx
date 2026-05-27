import { AppShell } from "@/components/app-shell";

const integrations = [
  ["Supabase", "Auth, PostgreSQL, RLS, Realtime chat"],
  ["Zoom", "Server-to-server OAuth, meetings, reports, recording webhooks"],
  ["Google Drive", "Admin account folders, resources, recording storage"],
  ["VPS worker", "Long-running recording download and upload jobs"]
];

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1>Platform connections</h1>
          <p className="muted">Secrets stay server-side; mobile clients use Supabase anon access with RLS.</p>
        </div>
      </div>

      <section className="grid two">
        {integrations.map(([name, body]) => (
          <article className="card" key={name}>
            <h2>{name}</h2>
            <p className="muted">{body}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
