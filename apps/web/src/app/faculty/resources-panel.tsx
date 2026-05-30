"use client";

import { FormEvent, useState } from "react";
import { resourceKinds } from "@zoom-lms/shared";
import { apiCall, apiUpload, formatBytes, formatDateTime, useApiFetch } from "@/components/use-fetch";
import { confirmAction } from "@/components/confirm-dialog";
import type { GroupOption } from "./faculty-client";

type Resource = {
  id: string;
  ownerId: string;
  ownerName: string | null;
  groupId: string;
  groupName: string | null;
  groupCode: string | null;
  title: string;
  kind: string;
  sizeBytes: number;
  driveFileId: string;
  viewUrl: string | null;
  downloadUrl: string | null;
  createdAt: string;
};

export function ResourcesPanel({ groups, role }: { groups: GroupOption[]; role: "admin" | "faculty" }) {
  const [groupId, setGroupId] = useState<string>("");
  const { data, loading, error, reload } = useApiFetch<{ resources: Resource[] }>(
    `/api/resources${groupId ? `?groupId=${groupId}` : ""}`,
    [groupId]
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get("groupId") || !form.get("title") || !form.get("file")) {
      setMessage({ kind: "error", text: "Group, title, and file required." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await apiUpload("/api/resources", form);
      setMessage({ kind: "success", text: "Resource uploaded." });
      event.currentTarget.reset();
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(r: Resource) {
    const ok = await confirmAction({
      title: `Delete "${r.title}"?`,
      description: "This removes the resource record and the underlying file from Google Drive.",
      confirmLabel: "Delete resource",
      variant: "danger"
    });
    if (!ok) return;
    try {
      await apiCall(`/api/resources/${r.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  const resources = data?.resources ?? [];

  return (
    <section className="grid two">
      <article className="card">
        <h2>Upload resource</h2>
        <p className="muted">Files upload to Drive at Groups/&lt;group&gt;/Resources/.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Group
            <select name="groupId" required>
              <option value="">Select group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Kind
            <select name="kind">
              <option value="">Auto detect</option>
              {resourceKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label>
            File
            <input name="file" type="file" required />
          </label>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Uploading…" : "Upload"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>
      </article>

      <article className="card">
        <h2>Resources</h2>
        <label style={{ marginBottom: 12, display: "block", color: "var(--muted)" }}>
          Filter group
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && resources.length === 0 ? <p className="empty">No resources.</p> : null}
        {resources.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Group</th>
                <th>Kind</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.groupName}</td>
                  <td><span className="chip">{r.kind}</span></td>
                  <td>{formatBytes(r.sizeBytes)}</td>
                  <td>{formatDateTime(r.createdAt)}</td>
                  <td>
                    <div className="actions">
                      {r.viewUrl ? (
                        <a className="button small" href={r.viewUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : null}
                      <button className="button small danger" type="button" onClick={() => remove(r)}>
                        Delete
                      </button>
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
