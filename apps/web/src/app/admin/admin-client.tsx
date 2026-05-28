"use client";

import { useState } from "react";
import { UsersTab } from "./users-tab";
import { GroupsTab } from "./groups-tab";

const tabs = [
  { id: "users", label: "Users" },
  { id: "groups", label: "Groups" }
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminClient({ initialTab }: { initialTab: string }) {
  const [tab, setTab] = useState<TabId>((tabs.find((t) => t.id === initialTab)?.id ?? "users") as TabId);

  return (
    <>
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "users" ? <UsersTab /> : null}
      {tab === "groups" ? <GroupsTab /> : null}
    </>
  );
}
