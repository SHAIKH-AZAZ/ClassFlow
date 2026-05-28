"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRoleHome, type AppRole } from "@/lib/auth-constants";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserClient();
  const search = useSearchParams();
  const next = search?.get("next") ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    // Sign in client-side first so the browser cookie store has the session.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      setMessage(error?.message ?? "Sign in failed.");
      setLoading(false);
      return;
    }

    // Mirror the session into HTTP-only cookies via the server route, so
    // proxy / page guards / API guards see it on the very next request.
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include"
    }).catch(() => null);

    // Pull role from /api/auth/session, which uses service-role server-side.
    const sessionResp = await fetch("/api/auth/session", { credentials: "include" });
    const sessionJson = (await sessionResp.json().catch(() => ({}))) as {
      profile?: { role?: AppRole };
    };
    const role = sessionJson.profile?.role;

    setMessage(`Signed in as ${role ?? "user"}. Redirecting...`);
    window.location.href = next ?? getRoleHome(role);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <button className="button" disabled={loading} type="submit">
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
