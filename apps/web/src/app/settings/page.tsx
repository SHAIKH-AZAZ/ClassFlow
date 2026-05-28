import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  await requirePageRole(["admin"], "/settings");

  const integrationStatus = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    zoom: Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET),
    zoomWebhook: Boolean(process.env.ZOOM_WEBHOOK_SECRET_TOKEN),
    googleDrive: Boolean(
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
    )
  };

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1>Platform connections</h1>
          <p className="muted">Server-side credentials drive Zoom, Google Drive, and the recording worker.</p>
        </div>
      </div>

      <section className="grid stats" aria-label="Integration status">
        {[
          { label: "Supabase", ok: integrationStatus.supabase },
          { label: "Zoom OAuth", ok: integrationStatus.zoom },
          { label: "Zoom Webhook", ok: integrationStatus.zoomWebhook },
          { label: "Google Drive", ok: integrationStatus.googleDrive }
        ].map((row) => (
          <article className="card" key={row.label}>
            <div className="stat-value" style={{ color: row.ok ? "var(--accent)" : "var(--danger)" }}>
              {row.ok ? "Configured" : "Missing"}
            </div>
            <div className="muted">{row.label}</div>
          </article>
        ))}
      </section>

      <SettingsClient />
    </AppShell>
  );
}
