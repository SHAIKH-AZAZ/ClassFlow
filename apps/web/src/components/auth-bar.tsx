"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ProfileState = {
  full_name: string;
  role: string;
  email: string | null;
} | null;

export function AuthBar() {
  const [profile, setProfile] = useState<ProfileState>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (alive) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, email")
        .eq("id", user.id)
        .single();

      if (alive) {
        setProfile(data ?? { full_name: user.email ?? "Signed in", role: "unknown", email: user.email ?? null });
        setLoading(false);
      }
    }

    loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return <span className="badge">Checking session</span>;
  }

  if (!profile) {
    return (
      <a className="button secondary" href="/login">
        Sign in
      </a>
    );
  }

  return (
    <div className="authbar">
      <span className="badge">
        {profile.full_name} · {profile.role}
      </span>
      <button className="button secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
