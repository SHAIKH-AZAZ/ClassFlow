export const roles = ["admin", "faculty", "student"] as const;
export type Role = (typeof roles)[number];

export const lectureStatuses = ["draft", "scheduled", "live", "completed", "cancelled"] as const;
export type LectureStatus = (typeof lectureStatuses)[number];

export const attendanceStatuses = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const recordingJobStatuses = ["queued", "processing", "completed", "failed"] as const;
export type RecordingJobStatus = (typeof recordingJobStatuses)[number];

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

export type ResourceKind = "pdf" | "document" | "image" | "video" | "presentation" | "other";

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
