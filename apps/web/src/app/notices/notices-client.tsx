"use client";

import { FormEvent, useState } from "react";
import { apiCall, formatDateTime, useApiFetch } from "@/components/use-fetch";

type Notice = {
  id: string;
  groupId: string | null;
  title: string;
  body: string;
  groupName: string | null;
  groupCode: string | null;
  authorName: string | null;
  createdAt: string;
};

export function NoticesClient({
  role,
  groups
}: {
  role: "admin" | "faculty" | "student";
  groups: { id: string; name: string; code: string }[];
}) {
  const [filter, setFilter] = useState<string>("all");
  const fetchUrl =
    filter === "all" ? "/api/notices" : filter === "global" ? "/api/notices?groupId=global" : `/api/notices?groupId=${filter}`;
  const { data, loading, error, reload } = useApiFetch<{ notices: Notice[] }>(fetchUrl, [filter]);
  const [form, setForm] = useState({ groupId: "global", title: "", body: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await apiCall("/api/notices", {
        method: "POST",
        body: JSON.stringify({
          groupId: form.groupId === "global" ? null : form.groupId,
          title: form.title,
          body: form.body
        })
      });
      setMessage({ kind: "success", text: "Notice posted." });
      setForm({ ...form, title: "", body: "" });
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(notice: Notice) {
    if (!window.confirm(`Delete "${notice.title}"?`)) return;
    try {
      await apiCall(`/api/notices/${notice.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  const canPost = role === "admin" || role === "faculty";
  const notices = data?.notices ?? [];

  return (
    <section className="grid two">
      {canPost ? (
        <article className="card">
          <h2>Post notice</h2>
          <form className="form" onSubmit={onSubmit}>
            <label>
              Audience
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="global">Institute-wide</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              Body
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </label>
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "Posting…" : "Post notice"}
            </button>
            {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
          </form>
        </article>
      ) : null}

      <article className="card" style={canPost ? undefined : { gridColumn: "1 / -1" }}>
        <h2>All notices</h2>
        {role !== "student" ? (
          <label style={{ marginBottom: 12, display: "block", color: "var(--muted)" }}>
            Filter
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="all">All</option>
              <option value="global">Institute-wide</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && notices.length === 0 ? <p className="empty">No notices.</p> : null}

        <div className="list">
          {notices.map((n) => (
            <div key={n.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <strong>{n.title}</strong>
                {canPost ? (
                  <button className="button small danger" type="button" onClick={() => remove(n)}>
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {n.groupName ? `${n.groupName} · ` : "Institute-wide · "}
                {n.authorName ?? "Admin"} · {formatDateTime(n.createdAt)}
              </div>
              <p style={{ margin: 0 }}>{n.body}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
