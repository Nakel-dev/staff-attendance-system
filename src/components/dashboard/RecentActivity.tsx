import { formatDate, formatTime } from "@/lib/utils/formatDate";
import { ATTENDANCE_STATUS_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";
import type { Attendance } from "@/lib/types";
import { ClipboardList } from "lucide-react";

interface RecentActivityProps {
  records: Attendance[];
}

const statusVariant: Record<string, "success" | "danger" | "warning" | "secondary"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  "half-day": "secondary",
};

export function RecentActivity({ records }: RecentActivityProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <ClipboardList className="h-10 w-10 mb-2" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div key={record.id} className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {record.profiles?.full_name || "Unknown Staff"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(record.date)}
              {record.check_in_time && ` · ${formatTime(record.check_in_time)}`}
            </p>
          </div>
          <Badge variant={statusVariant[record.status] || "secondary"}>
            {ATTENDANCE_STATUS_LABELS[record.status] || record.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
