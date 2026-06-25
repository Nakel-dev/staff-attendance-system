"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportTable, type ReportRow } from "@/components/reports/ReportTable";
import { ExportButton } from "@/components/reports/ExportButton";
import { DEPARTMENTS } from "@/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Attendance, Leave, Profile } from "@/lib/types";
import { calculateReportRow } from "@/lib/utils/calculateStats";
import { getWorkingDaysInMonth } from "@/lib/utils/formatDate";

interface ReportsViewProps {
  staff: Profile[];
  attendance: Attendance[];
  leaves: Leave[];
}

export function ReportsView({ staff, attendance, leaves }: ReportsViewProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [department, setDepartment] = useState("all");

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;
  const workingDays = getWorkingDaysInMonth(year, month);

  const rows: ReportRow[] = useMemo(() => {
    const activeStaff = staff.filter(
      (s) => s.is_active && s.role === "staff" && (department === "all" || s.department === department)
    );

    return activeStaff.map((member) => {
      const memberAttendance = attendance.filter(
        (a) => a.staff_id === member.id && a.date >= monthStart && a.date <= monthEnd
      );
      const memberLeaves = leaves.filter(
        (l) =>
          l.staff_id === member.id &&
          l.status === "approved" &&
          l.start_date <= monthEnd &&
          l.end_date >= monthStart
      );
      return calculateReportRow(
        member.full_name,
        member.department,
        memberAttendance,
        memberLeaves,
        workingDays
      );
    });
  }, [staff, attendance, leaves, monthStart, monthEnd, department, workingDays]);

  const chartData = rows.map((r) => ({
    name: r.staffName.split(" ")[0],
    attendance: r.attendancePercent,
  }));

  const deptSummary = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    rows.forEach((r) => {
      const existing = map.get(r.department) || { total: 0, count: 0 };
      map.set(r.department, {
        total: existing.total + r.attendancePercent,
        count: existing.count + 1,
      });
    });
    return Array.from(map.entries()).map(([dept, { total, count }]) => ({
      department: dept,
      average: count > 0 ? Math.round(total / count) : 0,
    }));
  }, [rows]);

  const exportColumns = [
    { key: "staffName", label: "Name" },
    { key: "department", label: "Department" },
    { key: "workingDays", label: "Working Days" },
    { key: "present", label: "Present" },
    { key: "absent", label: "Absent" },
    { key: "late", label: "Late" },
    { key: "halfDay", label: "Half Day" },
    { key: "leaveDays", label: "Leave Days" },
    { key: "attendancePercent", label: "Attendance %" },
  ];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleString("default", { month: "long" }),
  }));

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename={`attendance-report-${year}-${month}.csv`}
            rows={rows}
            columns={exportColumns}
          />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <ReportTable rows={rows} />

      <div className="grid gap-4 lg:grid-cols-2 no-print">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="attendance" fill="#3b82f6" name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Department Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deptSummary.map((d) => (
                <div key={d.department} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{d.department}</span>
                  <span className="text-sm text-muted-foreground">{d.average}% avg</span>
                </div>
              ))}
              {deptSummary.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
