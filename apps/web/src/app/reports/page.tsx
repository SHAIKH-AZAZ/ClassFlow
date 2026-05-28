import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  await requirePageRole(["admin", "faculty"], "/reports");

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Reports</p>
          <h1>Institute summary</h1>
          <p className="muted">Live counts across users, lectures, attendance, storage, and recording jobs.</p>
        </div>
      </div>
      <ReportsClient />
    </AppShell>
  );
}
