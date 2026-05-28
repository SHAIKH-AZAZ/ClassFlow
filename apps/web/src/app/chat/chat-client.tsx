"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiCall, formatDateTime, useApiFetch } from "@/components/use-fetch";

type ThreadMember = { id: string; fullName: string | null; role: string | null };
type Thread = {
  id: string;
  type: "group" | "direct";
  groupId: string | null;
  label: string;
  members: ThreadMember[];
  createdAt: string;
};

type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string | null;
  senderRole: string | null;
  body: string;
  createdAt: string;
};

export function ChatClient({
  currentUserId,
  role,
  groups,
  directory
}: {
  currentUserId: string;
  role: "admin" | "faculty" | "student";
  groups: { id: string; name: string; code: string }[];
  directory: { id: string; fullName: string; role: string }[];
}) {
  const { data, loading, error, reload } = useApiFetch<{ threads: Thread[] }>("/api/chat/threads");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newDirectId, setNewDirectId] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const threads = data?.threads ?? [];
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    let alive = true;

    async function loadInitial() {
      try {
        const json = await apiCall<{ messages: Message[] }>(`/api/chat/threads/${activeThreadId}/messages`);
        if (alive) {
          setMessages(json.messages);
          setTimeout(() => messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight), 0);
        }
      } catch {
        if (alive) setMessages([]);
      }
    }

    loadInitial();
    const interval = setInterval(async () => {
      const last = messagesRef.current && messages.length > 0 ? messages[messages.length - 1].createdAt : null;
      try {
        const json = await apiCall<{ messages: Message[] }>(
          `/api/chat/threads/${activeThreadId}/messages${last ? `?after=${encodeURIComponent(last)}` : ""}`
        );
        if (alive && json.messages.length > 0) {
          setMessages((prev) => [...prev, ...json.messages]);
          setTimeout(() => messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight), 0);
        }
      } catch {
        // ignore polling failures
      }
    }, 4000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeThreadId || !draft.trim()) return;
    setSending(true);
    try {
      const json = await apiCall<{ message: Message }>(`/api/chat/threads/${activeThreadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft })
      });
      setMessages((prev) => [...prev, { ...json.message, senderName: "You", senderRole: role }]);
      setDraft("");
      setTimeout(() => messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight), 0);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  async function startDirect() {
    if (!newDirectId) return;
    try {
      const json = await apiCall<{ thread: { id: string } }>("/api/chat/threads", {
        method: "POST",
        body: JSON.stringify({ type: "direct", participantIds: [newDirectId] })
      });
      reload();
      setActiveThreadId(json.thread.id);
      setNewDirectId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function startGroupThread() {
    if (!newGroupId) return;
    try {
      const json = await apiCall<{ thread: { id: string } }>("/api/chat/threads", {
        method: "POST",
        body: JSON.stringify({ type: "group", groupId: newGroupId })
      });
      reload();
      setActiveThreadId(json.thread.id);
      setNewGroupId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed.");
    }
  }

  return (
    <section className="grid two" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
      <article className="card">
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label>
            Start direct chat
            <select value={newDirectId} onChange={(e) => setNewDirectId(e.target.value)}>
              <option value="">Select user…</option>
              {directory.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} · {d.role}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="button small" type="button" disabled={!newDirectId} onClick={startDirect}>
              Open
            </button>
          </div>
          {role !== "student" ? (
            <>
              <label>
                Open group chat
                <select value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)}>
                  <option value="">Select group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button className="button small" type="button" disabled={!newGroupId} onClick={startGroupThread}>
                  Open
                </button>
              </div>
            </>
          ) : null}
        </div>

        {error ? <p className="form-message error">{error}</p> : null}

        <div className="chat">
          <div className="chat-threads">
            <div className="chat-threads-list">
              {loading ? <p className="muted" style={{ padding: 8 }}>Loading…</p> : null}
              {!loading && threads.length === 0 ? <p className="empty">No threads yet.</p> : null}
              {threads.map((t) => (
                <button
                  key={t.id}
                  className={`chat-thread ${activeThreadId === t.id ? "active" : ""}`}
                  onClick={() => setActiveThreadId(t.id)}
                  type="button"
                >
                  <div style={{ fontWeight: 600 }}>{t.label}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {t.type === "group" ? "Group" : "Direct"} · {t.members.length} members
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="chat-pane">
            {activeThread ? (
              <>
                <div className="chat-messages" ref={messagesRef}>
                  {messages.length === 0 ? <p className="empty">No messages yet.</p> : null}
                  {messages.map((m) => (
                    <div key={m.id} className={`chat-bubble ${m.senderId === currentUserId ? "mine" : ""}`}>
                      <small>
                        {m.senderName ?? (m.senderId === currentUserId ? "You" : "User")} · {formatDateTime(m.createdAt)}
                      </small>
                      <div>{m.body}</div>
                    </div>
                  ))}
                </div>
                <form className="chat-input" onSubmit={sendMessage}>
                  <input
                    placeholder={`Message ${activeThread.label}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="button" type="submit" disabled={sending || !draft.trim()}>
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="empty">Pick or start a conversation.</div>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
