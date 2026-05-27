import { AppShell } from "@/components/app-shell";

const actions = [
  "Schedule lecture and create Zoom meeting",
  "Start class from Zoom host link",
  "Upload resources to Google Drive",
  "Review attendance and apply corrections",
  "Send group notices and student remarks"
];

export default function FacultyPage() {
  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Faculty workspace</p>
          <h1>Lectures, resources, attendance</h1>
          <p className="muted">Faculty actions are constrained by assigned groups and mapped Zoom host accounts.</p>
        </div>
        <span className="badge live">Zoom ready</span>
      </div>

      <section className="grid stats">
        {actions.map((action, index) => (
          <article className="card" key={action}>
            <div className="stat-value">{index + 1}</div>
            <div>{action}</div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
