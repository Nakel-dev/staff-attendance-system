export type Role = "admin" | "staff";
export type AttendanceStatus = "present" | "absent" | "late" | "half-day";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type LeaveType = "sick" | "annual" | "emergency" | "maternity" | "unpaid";
export type NotificationType =
  | "leave_request"
  | "leave_approved"
  | "leave_rejected"
  | "attendance_marked"
  | "general";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone?: string;
  department: string;
  role: Role;
  avatar_url?: string;
  is_active: boolean;
  date_joined: string;
  created_at: string;
  updated_at: string;
  organizations?: Organization;
}

export interface Attendance {
  id: string;
  staff_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  note?: string;
  marked_by?: string;
  created_at: string;
  updated_at?: string;
  profiles?: Profile;
}

export interface Leave {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  admin_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  lateToday: number;
  pendingLeaves: number;
  attendanceRate: number;
}
