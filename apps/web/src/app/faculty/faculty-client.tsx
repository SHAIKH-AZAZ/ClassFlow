"use client";

import { useState } from "react";
import { LecturesPanel } from "./lectures-panel";
import { RecordingsPanel } from "./recordings-panel";
import { ResourcesPanel } from "./resources-panel";
import { AttendancePanel } from "./attendance-panel";
import { RemarksPanel } from "./remarks-panel";

const tabs = [
  { id: "lectures", label: "Lectures" },
  { id: "recordings", label: "Recordings" },
  { id: "resources", label: "Resources" },
  { id: "attendance", label: "Attendance" },
  { id: "remarks", label: "Remarks" }
] as const;

export type TabId = (typeof tabs)[number]["id"];

export type GroupOption = { id: string; name: string; code: string };
export type FacultyOption = { id: string; fullName: string; zoomHostUserId: string | null };

export function FacultyClient({
  initialTab,
  role,
  facultyProfileId,
  groups,
  faculties
}: {
  initialTab: string;
  role: "admin" | "faculty";
  facultyProfileId: string | null;
  groups: GroupOption[];
  faculties: FacultyOption[];
}) {
  const [tab, setTab] = useState<TabId>((tabs.find((t) => t.id === initialTab)?.id ?? "lectures") as TabId);

  return (
    <>
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "lectures" ? (
        <LecturesPanel role={role} facultyProfileId={facultyProfileId} groups={groups} faculties={faculties} />
      ) : null}
      {tab === "recordings" ? <RecordingsPanel /> : null}
      {tab === "resources" ? <ResourcesPanel groups={groups} role={role} /> : null}
      {tab === "attendance" ? <AttendancePanel /> : null}
      {tab === "remarks" ? <RemarksPanel /> : null}
    </>
  );
}
