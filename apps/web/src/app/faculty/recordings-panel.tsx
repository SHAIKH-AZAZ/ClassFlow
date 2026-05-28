"use client";

import { FormEvent, useState } from "react";
import { apiUpload, formatBytes, formatDateTime, useApiFetch } from "@/components/use-fetch";

type LectureItem = {
  id: string;
  title: string;
  startsAt: string;
  groupName: string | null;
};

type Recording = {
  id: string;
  lectureId: string | null;
  lectureTitle: string | null;
  lectureStartsAt: string | null;
  groupName: string | null;
  driveFileId: string | null;
  viewUrl: string | null;
  downloadUrl: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export function RecordingsPanel() {
  const { data: lecturesData } = useApiFetch<{ lectures: LectureItem[] }>("/api/lectures");
  const { data: recordingsData, loading, error, reload } = useApiFetch<{ recordings: Recording[] }>("/api/recordings");

  const [lectureId, setLectureId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!formData.get("lectureId") || !formData.get("file")) {
      setMessage({ kind: "error", text: "Lecture and file required." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      await apiUpload("/api/recordings/manual", formData);
      setMessage({ kind: "success", text: "Recording uploaded." });
      event.currentTarget.reset();
      setLectureId("");
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setSubmitting(false);
    }
  }

  const lectures = lecturesData?.lectures ?? [];
  const recordings = recordingsData?.recordings ?? [];

  return (
    <section className="grid two">
      <article className="card">
        <h2>Upload recording</h2>
        <p className="muted">For Zoom Basic, record locally during class then upload here. The file goes to Drive under Groups/&lt;group&gt;/Lectures/&lt;date&gt;/.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Lecture
            <select name="lectureId" value={lectureId} onChange={(e) => setLectureId(e.target.value)} required>
              <option value="">Select lecture…</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} · {l.groupName ?? "?"} · {formatDateTime(l.startsAt)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recording file
            <input name="file" type="file" accept="video/*" required />
          </label>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Uploading…" : "Upload"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>
      </article>

      <article className="card">
        <h2>Recordings</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && recordings.length === 0 ? <p className="empty">No recordings yet.</p> : null}
        {recordings.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Lecture</th>
                <th>Uploaded</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.lectureTitle ?? "Unknown"}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.groupName ?? ""}
                    </div>
                  </td>
                  <td>{formatDateTime(r.createdAt)}</td>
                  <td>{formatBytes(r.sizeBytes ?? 0)}</td>
                  <td>
                    <div className="actions">
                      {r.viewUrl ? (
                        <a className="button small" href={r.viewUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : null}
                      {r.downloadUrl ? (
                        <a className="button small ghost" href={r.downloadUrl} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
