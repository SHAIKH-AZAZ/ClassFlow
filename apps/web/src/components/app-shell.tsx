import type { ReactNode } from "react";
import { AuthBar } from "./auth-bar";

const navItems = [
  ["Dashboard", "/"],
  ["Admin", "/admin"],
  ["Faculty", "/faculty"],
  ["Reports", "/reports"],
  ["Integrations", "/settings"]
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">Institute Zoom LMS</div>
        <nav className="nav" aria-label="Main navigation">
          {navItems.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <AuthBar />
        </div>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
