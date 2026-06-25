export const DEPARTMENTS = [
  "Administration",
  "Sciences",
  "Mathematics",
  "English",
  "Arts",
  "Physical Education",
  "ICT",
  "History",
  "Library",
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

export const SYSTEM_NAME = "Staff Attendance Management System";
export const SCHOOL_NAME = "Greenwood Academy";
