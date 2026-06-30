export const DEPARTMENTS = [
  "Administration",
  "Operations",
  "Sales",
  "Marketing",
  "Engineering",
  "Human Resources",
  "Finance",
  "Customer Support",
  "General",
] as const;

export const LEAVE_BALANCE = {
  annual: 20,
  sick: 10,
} as const;

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  late: "bg-yellow-500",
  "half-day": "bg-orange-500",
  none: "bg-gray-300 dark:bg-gray-600",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  "half-day": "Half Day",
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "Sick",
  annual: "Annual",
  emergency: "Emergency",
  maternity: "Maternity",
  unpaid: "Unpaid",
};

export const ATTENDANCE_MODE_LABELS: Record<string, string> = {
  trust: "Trust — self check-in, no location or photo",
  standard: "Standard — geofence + live video + face match",
  strict: "Strict — geofence + live video + face match + reception QR",
  admin_only: "Admin only — manager marks attendance manually",
};

export const ATTENDANCE_MODES = ["trust", "standard", "strict", "admin_only"] as const;

export const APP_NAME = "AttendPro";
export const APP_TAGLINE = "Staff attendance for any organization";
export const AUTH_PATH = "/auth";

export function getHomePath(role: "admin" | "staff") {
  return role === "admin" ? "/dashboard" : "/my-attendance";
}
/** @deprecated Use APP_NAME */
export const SYSTEM_NAME = APP_NAME;
