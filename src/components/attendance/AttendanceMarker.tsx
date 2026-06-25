"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_STATUS_LABELS } from "@/constants";
import { checkInStaff, saveAttendanceBatch } from "@/lib/actions/attendance";
import { formatTime } from "@/lib/utils/formatDate";
import type { Attendance, AttendanceStatus, Profile } from "@/lib/types";

interface AttendanceMarkerProps {
  mode: "admin" | "staff";
  staff?: Profile[];
  existingRecords?: Attendance[];
  todayRecord?: Attendance | null;
}

type StaffAttendanceRow = {
  staff_id: string;
  full_name: string;
  department: string;
  status: AttendanceStatus;
  note: string;
};

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "half-day"];

export function AttendanceMarker({
  mode,
  staff = [],
  existingRecords = [],
  todayRecord,
}: AttendanceMarkerProps) {
  const router = useRouter();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<StaffAttendanceRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const activeStaff = useMemo(
    () => staff.filter((member) => member.is_active && member.role === "staff"),
    [staff]
  );

  const recordsForDate = useMemo(
    () => existingRecords.filter((record) => record.date === date),
    [existingRecords, date]
  );

  useEffect(() => {
    setRows(
      activeStaff.map((member) => {
        const existing = recordsForDate.find((record) => record.staff_id === member.id);
        return {
          staff_id: member.id,
          full_name: member.full_name,
          department: member.department,
          status: existing?.status || ("present" as AttendanceStatus),
          note: existing?.note || "",
        };
      })
    );
  }, [activeStaff, recordsForDate, date]);

  const updateRow = (staffId: string, updates: Partial<StaffAttendanceRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.staff_id === staffId ? { ...row, ...updates } : row))
    );
  };

  const applyBulkStatus = (status: AttendanceStatus) => {
    setRows((prev) => prev.map((row) => ({ ...row, status })));
    toast.success(`Marked all as ${ATTENDANCE_STATUS_LABELS[status]}`);
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      toast.error("No staff to mark attendance for");
      return;
    }
    setIsSaving(true);
    const result = await saveAttendanceBatch(
      rows.map((row) => ({
        staff_id: row.staff_id,
        date,
        status: row.status,
        note: row.note || undefined,
      })),
      date
    );
    setIsSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Attendance saved successfully");
    router.refresh();
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    const result = await checkInStaff();
    setIsCheckingIn(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Checked in at ${result.checkInTime ? formatTime(result.checkInTime) : "now"}`);
    router.refresh();
  };

  if (mode === "staff") {
    const hasCheckedIn = !!todayRecord?.check_in_time;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Daily Check-In
          </CardTitle>
          <CardDescription>
            Record your arrival for {format(new Date(), "MMMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasCheckedIn ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                Checked in at {formatTime(todayRecord!.check_in_time!)} —{" "}
                {ATTENDANCE_STATUS_LABELS[todayRecord!.status]}
              </span>
            </div>
          ) : (
            <Button onClick={handleCheckIn} disabled={isCheckingIn} size="lg">
              {isCheckingIn ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Check In Now
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Label htmlFor="attendance-date">Date</Label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-[200px]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => applyBulkStatus("present")}>
            Mark All Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyBulkStatus("absent")}>
            Mark All Absent
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyBulkStatus("late")}>
            Mark All Late
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No active staff members found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.staff_id}>
                  <TableCell className="font-medium">{row.full_name}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>
                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        updateRow(row.staff_id, { status: value as AttendanceStatus })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Optional note"
                      value={row.note}
                      onChange={(e) => updateRow(row.staff_id, { note: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || rows.length === 0}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Attendance
        </Button>
      </div>
    </div>
  );
}
