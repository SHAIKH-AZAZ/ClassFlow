"use client";

import { FormEvent, useState } from "react";
import { apiCall, formatDateTime, useApiFetch } from "@/components/use-fetch";

type Setting = {
  key: string;
  value: unknown;
  encrypted: boolean;
  updated_at: string;
};

export function SettingsClient() {
  const { data, loading, error, reload } = useApiFetch<{ settings: Setting[] }>("/api/admin/settings");
  const [form, setForm] = useState({ key: "", value: "", encrypted: false });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    let value: unknown = form.value;
    try {
      value = JSON.parse(form.value);
    } catch {
      // accept raw string if not valid JSON
    }
    try {
      await apiCall("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: form.key, value, encrypted: form.encrypted })
      });
      setMessage({ kind: "success", text: "Setting saved." });
      setForm({ key: "", value: "", encrypted: false });
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid two" style={{ marginTop: 16 }}>
      <article className="card">
        <h2>Set integration value</h2>
        <p className="muted">Stored in <span className="kbd">integration_settings</span>. Use JSON for objects, otherwise the raw string is stored.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Key
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
          </label>
          <label>
            Value
            <textarea value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </label>
          <label style={{ flexDirection: "row", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.encrypted}
              onChange={(e) => setForm({ ...form, encrypted: e.target.checked })}
            />
            <span>Mark as encrypted</span>
          </label>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
          {message ? <p className={`form-message ${message.kind}`}>{message.text}</p> : null}
        </form>
      </article>

      <article className="card">
        <h2>Saved settings</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        {!loading && (data?.settings ?? []).length === 0 ? <p className="empty">No settings yet.</p> : null}
        {data?.settings && data.settings.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.settings.map((setting) => (
                <tr key={setting.key}>
                  <td>
                    <span className="kbd">{setting.key}</span>
                    {setting.encrypted ? <div className="muted" style={{ fontSize: 11 }}>encrypted</div> : null}
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{JSON.stringify(setting.value)}</code>
                  </td>
                  <td>{formatDateTime(setting.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
