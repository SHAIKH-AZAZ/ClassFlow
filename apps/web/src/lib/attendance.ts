import type { AttendanceStatus } from "@zoom-lms/shared";

export function calculateAttendanceStatus(durationMinutes: number, lectureMinutes: number, thresholdPercent: number): AttendanceStatus {
  const requiredMinutes = lectureMinutes * (thresholdPercent / 100);
  return durationMinutes >= requiredMinutes ? "present" : "absent";
}

export function minutesBetween(startsAt: string, endsAt: string) {
  const durationMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, Math.round(durationMs / 60_000));
}
