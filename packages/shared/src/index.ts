export const roles = ["admin", "faculty", "student"] as const;
export type Role = (typeof roles)[number];

export const lectureStatuses = ["draft", "scheduled", "live", "completed", "cancelled"] as const;
export type LectureStatus = (typeof lectureStatuses)[number];

export const attendanceStatuses = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const recordingJobStatuses = ["queued", "processing", "completed", "failed"] as const;
export type RecordingJobStatus = (typeof recordingJobStatuses)[number];

export const resourceKinds = ["pdf", "document", "image", "video", "presentation", "other"] as const;
export type ResourceKind = (typeof resourceKinds)[number];

export const chatThreadTypes = ["group", "direct"] as const;
export type ChatThreadType = (typeof chatThreadTypes)[number];

export type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: Role;
  active: boolean;
};

export type Group = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
};

export type Lecture = {
  id: string;
  title: string;
  description: string | null;
  groupId: string;
  facultyId: string;
  startsAt: string;
  endsAt: string;
  status: LectureStatus;
  attendanceThresholdPercent: number;
};

export type ZoomMeeting = {
  id: string;
  lectureId: string;
  zoomMeetingId: string;
  hostId: string;
  joinUrl: string;
  startUrl?: string;
};

export type AttendanceRow = {
  lectureId: string;
  studentId: string;
  durationMinutes: number;
  requiredMinutes: number;
  status: AttendanceStatus;
  overridden: boolean;
};

export type Resource = {
  id: string;
  ownerId: string;
  groupId: string;
  title: string;
  kind: ResourceKind;
  sizeBytes: number;
  driveFileId: string;
  viewUrl: string;
  downloadUrl: string | null;
};

export type CreateLectureInput = {
  title: string;
  description?: string;
  groupId: string;
  facultyId: string;
  startsAt: string;
  endsAt: string;
  attendanceThresholdPercent?: number;
};

export type CreateResourceInput = {
  ownerId: string;
  groupId: string;
  title: string;
  kind: ResourceKind;
  sizeBytes: number;
  driveFileId: string;
  viewUrl: string;
  downloadUrl?: string;
};

export type Notice = {
  id: string;
  groupId: string | null;
  title: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
};

export type Remark = {
  id: string;
  studentId: string;
  facultyId: string | null;
  lectureId: string | null;
  body: string;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  type: ChatThreadType;
  groupId: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export function inferResourceKind(mimeType: string | null | undefined, fileName?: string): ResourceKind {
  const lowered = (mimeType ?? "").toLowerCase();
  if (lowered.startsWith("video/")) return "video";
  if (lowered.startsWith("image/")) return "image";
  if (lowered === "application/pdf" || (fileName ?? "").toLowerCase().endsWith(".pdf")) return "pdf";
  if (lowered.includes("presentation") || /\.(ppt|pptx|key)$/i.test(fileName ?? "")) return "presentation";
  if (
    lowered.startsWith("text/") ||
    lowered.includes("word") ||
    lowered.includes("officedocument") ||
    /\.(doc|docx|txt|md|rtf|csv|xls|xlsx)$/i.test(fileName ?? "")
  ) {
    return "document";
  }
  return "other";
}
