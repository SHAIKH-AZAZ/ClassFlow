import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth-server";
import { AdminClient } from "./admin-client";

export default async function AdminPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  await requirePageRole(["admin"], "/admin");
  const params = await searchParams;
  const tab = (Array.isArray(params?.tab) ? params.tab[0] : params?.tab) ?? "users";

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Users, groups, and settings</h1>
          <p className="muted">Provision identities, manage class batches, and connect integrations.</p>
        </div>
      </div>

      <AdminClient initialTab={tab as string} />
    </AppShell>
  );
}
