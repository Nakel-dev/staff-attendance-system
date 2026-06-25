"use client";

import { useMemo, useState } from "react";
import { AttendanceCalendar } from "@/components/attendance/AttendanceCalendar";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calculateAttendanceSummary } from "@/lib/utils/calculateStats";
import { getMonthDateRange } from "@/lib/utils/formatDate";
import type { Attendance, Leave } from "@/lib/types";

interface StaffProfileViewProps {
  staffId: string;
  initialMonth: number;
  initialYear: number;
  monthAttendance: Attendance[];
  allAttendance: Attendance[];
  leaves: Leave[];
}

export function StaffProfileView({
  initialMonth,
  initialYear,
  monthAttendance,
  allAttendance,
  leaves,
}: StaffProfileViewProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [filterMonth, setFilterMonth] = useState(
    `${initialYear}-${String(initialMonth).padStart(2, "0")}`
  );

  const calendarRecords = useMemo(() => {
    const { start, end } = getMonthDateRange(year, month);
    return allAttendance.filter((r) => r.date >= start && r.date <= end);
  }, [allAttendance, month, year]);

  const filteredHistory = useMemo(() => {
    const [y, m] = filterMonth.split("-").map(Number);
    const { start, end } = getMonthDateRange(y, m);
    return allAttendance.filter((r) => r.date >= start && r.date <= end);
  }, [allAttendance, filterMonth]);

  const summary = calculateAttendanceSummary(monthAttendance);

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Late</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{summary.late}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Half Day</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{summary.halfDay}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.rate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceCalendar
            records={calendarRecords}
            month={month}
            year={year}
            onMonthChange={handleMonthChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attendance History</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-month" className="sr-only">
              Filter by month
            </Label>
            <Input
              id="filter-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-auto"
            />
          </div>
        </CardHeader>
        <CardContent>
          <AttendanceTable records={filteredHistory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveTable leaves={leaves} showStaff={false} />
        </CardContent>
      </Card>
    </div>
  );
}
