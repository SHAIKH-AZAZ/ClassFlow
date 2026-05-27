import { AppShell } from "@/components/app-shell";

const actions = [
  "Schedule lecture and create Zoom meeting",
  "Start class from Zoom host link",
  "Upload local Zoom recordings to Google Drive",
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

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Upload Local Recording</h2>
          <p className="muted">
            For Zoom Basic, record to computer during class, then upload the saved video here.
          </p>
          <form action="/api/recordings/manual" method="post" encType="multipart/form-data" className="form">
            <label>
              Lecture ID
              <input name="lectureId" required placeholder="8057b4bd-8835-405a-9c3d-9ed43519e125" />
            </label>
            <label>
              Uploaded by profile ID
              <input name="uploadedBy" required placeholder="4fdf13f2-a475-4212-9743-4a758b1a63f0" />
            </label>
            <label>
              Recording file
              <input name="file" type="file" accept="video/*" required />
            </label>
            <button className="button" type="submit">
              Upload recording
            </button>
          </form>
        </article>

        <article className="card">
          <h2>Basic Zoom Recording Flow</h2>
          <div className="timeline">
            {[
              "Faculty starts the Zoom class",
              "Zoom records to the faculty computer",
              "Faculty uploads the local video file",
              "The app stores it in Drive and saves the link for students"
            ].map((item, index) => (
              <div className="timeline-item" key={item}>
                <strong>Step {index + 1}</strong>
                <div className="muted">{item}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
