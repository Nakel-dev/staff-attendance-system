import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ATTENDANCE_STATUS_LABELS } from "@/constants";
import { formatDate, formatTime } from "@/lib/utils/formatDate";
import type { Attendance } from "@/lib/types";

interface AttendanceTableProps {
  records: Attendance[];
  showStaff?: boolean;
}

const statusVariant: Record<string, "success" | "danger" | "warning" | "secondary"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  "half-day": "secondary",
};

export function AttendanceTable({ records, showStaff = true }: AttendanceTableProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-md border">
        <ClipboardList className="h-10 w-10 mb-2" />
        <p className="text-sm">No attendance records found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showStaff && <TableHead>Staff</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-medium">{formatDate(record.date)}</TableCell>
              {showStaff && (
                <TableCell>{record.profiles?.full_name || "—"}</TableCell>
              )}
              <TableCell>
                <Badge variant={statusVariant[record.status] || "secondary"}>
                  {ATTENDANCE_STATUS_LABELS[record.status] || record.status}
                </Badge>
              </TableCell>
              <TableCell>{record.check_in_time ? formatTime(record.check_in_time) : "—"}</TableCell>
              <TableCell>{record.check_out_time ? formatTime(record.check_out_time) : "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {record.note || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
