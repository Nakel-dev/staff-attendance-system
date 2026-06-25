import { BarChart3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAttendancePercentColor } from "@/lib/utils/calculateStats";
import { cn } from "@/lib/utils";

export interface ReportRow {
  staffName: string;
  department: string;
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leaveDays: number;
  attendancePercent: number;
  [key: string]: string | number;
}

interface ReportTableProps {
  rows: ReportRow[];
}

export function ReportTable({ rows }: ReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-md border">
        <BarChart3 className="h-10 w-10 mb-2" />
        <p className="text-sm">No report data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Working Days</TableHead>
            <TableHead className="text-right">Present</TableHead>
            <TableHead className="text-right">Absent</TableHead>
            <TableHead className="text-right">Late</TableHead>
            <TableHead className="text-right">Half Day</TableHead>
            <TableHead className="text-right">Leave Days</TableHead>
            <TableHead className="text-right">Attendance %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.staffName}-${row.department}`}>
              <TableCell className="font-medium">{row.staffName}</TableCell>
              <TableCell>{row.department}</TableCell>
              <TableCell className="text-right">{row.workingDays}</TableCell>
              <TableCell className="text-right text-green-600 dark:text-green-400">
                {row.present}
              </TableCell>
              <TableCell className="text-right text-red-600 dark:text-red-400">
                {row.absent}
              </TableCell>
              <TableCell className="text-right text-yellow-600 dark:text-yellow-400">
                {row.late}
              </TableCell>
              <TableCell className="text-right text-orange-600 dark:text-orange-400">
                {row.halfDay}
              </TableCell>
              <TableCell className="text-right">{row.leaveDays}</TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-semibold",
                    getAttendancePercentColor(row.attendancePercent)
                  )}
                >
                  {row.attendancePercent}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
