import type { ReactNode } from "react";
import { navItems } from "@/lib/auth-constants";
import { getCurrentAuthContext } from "@/lib/auth-server";
import { AuthBar } from "./auth-bar";

export async function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const { profile } = await getCurrentAuthContext();
  const visibleNavItems = profile ? navItems.filter((item) => item.roles.includes(profile.role)) : [];

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">Institute Zoom LMS</div>
        <nav className="nav" aria-label="Main navigation">
          {visibleNavItems.map(({ label, href }) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <AuthBar initialProfile={profile} />
        </div>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
