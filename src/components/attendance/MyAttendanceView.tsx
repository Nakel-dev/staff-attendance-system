"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AttendanceCalendar } from "@/components/attendance/AttendanceCalendar";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { AttendanceMarker } from "@/components/attendance/AttendanceMarker";
import { LiveAttendanceStatus } from "@/components/attendance/LiveAttendanceStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calculateAttendanceSummary } from "@/lib/utils/calculateStats";
import { getMonthDateRange, getWorkingDaysInMonth } from "@/lib/utils/formatDate";
import type { Attendance } from "@/lib/types";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface MyAttendanceViewProps {
  staffId: string;
  initialRecords: Attendance[];
  todayRecord: Attendance | null;
}

export function MyAttendanceView({
  staffId,
  initialRecords,
  todayRecord,
}: MyAttendanceViewProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const fetchMonthData = async (m: number, y: number) => {
    setLoading(true);
    const supabase = createClient();
    const { start, end } = getMonthDateRange(y, m);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", staffId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });
    if (data) setRecords((prev) => {
      const other = prev.filter((r) => r.date < start || r.date > end);
      return [...other, ...data];
    });
    setLoading(false);
  };

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
    fetchMonthData(newMonth, newYear);
  };

  const calendarRecords = useMemo(() => {
    const { start, end } = getMonthDateRange(year, month);
    return records.filter((r) => r.date >= start && r.date <= end);
  }, [records, month, year]);

  const filteredHistory = useMemo(() => {
    const [y, m] = filterMonth.split("-").map(Number);
    const { start, end } = getMonthDateRange(y, m);
    return records.filter((r) => r.date >= start && r.date <= end);
  }, [records, filterMonth]);

  const summary = calculateAttendanceSummary(calendarRecords);
  const workingDays = getWorkingDaysInMonth(year, month);

  return (
    <div className="space-y-6">
      <AttendanceMarker mode="staff" todayRecord={todayRecord} />
      <LiveAttendanceStatus staffId={staffId} />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Working Days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{workingDays}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <AttendanceCalendar
              records={calendarRecords}
              month={month}
              year={year}
              onMonthChange={handleMonthChange}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>History</CardTitle>
          <div>
            <Label htmlFor="history-month" className="sr-only">
              Filter month
            </Label>
            <Input
              id="history-month"
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
    </div>
  );
}
