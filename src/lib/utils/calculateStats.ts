import type { Attendance, AttendanceStatus, DashboardStats, Leave } from "@/lib/types";
import { format, subDays } from "date-fns";

export function calculateDashboardStats(
  totalStaff: number,
  todayAttendance: Attendance[],
  onLeaveToday: number,
  pendingLeaves: number
): DashboardStats {
  const presentToday = todayAttendance.filter((a) => a.status === "present").length;
  const absentToday = todayAttendance.filter((a) => a.status === "absent").length;
  const lateToday = todayAttendance.filter((a) => a.status === "late").length;
  const marked = todayAttendance.length;
  const attendanceRate =
    totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0;

  return {
    totalStaff,
    presentToday,
    absentToday,
    onLeaveToday,
    lateToday,
    pendingLeaves,
    attendanceRate: marked > 0 ? attendanceRate : 0,
  };
}

export function calculateAttendanceSummary(records: Attendance[]) {
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const halfDay = records.filter((r) => r.status === "half-day").length;
  const total = records.length;
  const rate = total > 0 ? Math.round(((present + late + halfDay * 0.5) / total) * 100) : 0;

  return { present, absent, late, halfDay, total, rate };
}

export function getLast7DaysChartData(allAttendance: Attendance[]) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return format(date, "yyyy-MM-dd");
  });

  return days.map((date) => {
    const dayRecords = allAttendance.filter((a) => a.date === date);
    return {
      date: format(new Date(date), "EEE"),
      present: dayRecords.filter((a) => a.status === "present").length,
      absent: dayRecords.filter((a) => a.status === "absent").length,
      late: dayRecords.filter((a) => a.status === "late").length,
    };
  });
}

export function getTodayPieData(stats: DashboardStats) {
  return [
    { name: "Present", value: stats.presentToday, fill: "#22c55e" },
    { name: "Absent", value: stats.absentToday, fill: "#ef4444" },
    { name: "Late", value: stats.lateToday, fill: "#eab308" },
    { name: "On Leave", value: stats.onLeaveToday, fill: "#3b82f6" },
  ].filter((d) => d.value > 0);
}

export function calculateReportRow(
  staffName: string,
  department: string,
  records: Attendance[],
  leaves: Leave[],
  workingDays: number
) {
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const halfDay = records.filter((r) => r.status === "half-day").length;
  const leaveDays = leaves
    .filter((l) => l.status === "approved")
    .reduce((sum, l) => sum + l.total_days, 0);
  const effectivePresent = present + late + halfDay * 0.5;
  const attendancePercent =
    workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 0;

  return {
    staffName,
    department,
    workingDays,
    present,
    absent,
    late,
    halfDay,
    leaveDays,
    attendancePercent,
  };
}

export function getAttendancePercentColor(percent: number) {
  if (percent >= 90) return "text-green-600 dark:text-green-400";
  if (percent >= 75) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function calculateLeaveBalance(
  approvedLeaves: Leave[],
  leaveType: "annual" | "sick",
  allowance: number
) {
  const used = approvedLeaves
    .filter((l) => l.leave_type === leaveType)
    .reduce((sum, l) => sum + l.total_days, 0);
  return { used, remaining: Math.max(0, allowance - used), allowance };
}

export type AttendanceRowInput = {
  staff_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  note?: string;
  marked_by?: string;
};
