import { Badge } from "@/components/ui/badge";
import { LEAVE_TYPE_LABELS } from "@/constants";
import type { LeaveStatus, LeaveType } from "@/lib/types";

interface LeaveStatusBadgeProps {
  kind: "status" | "type";
  value: LeaveStatus | LeaveType;
}

const statusConfig: Record<
  LeaveStatus,
  { label: string; variant: "warning" | "success" | "danger" }
> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

const typeConfig: Record<LeaveType, { label: string; className: string }> = {
  sick: { label: "Sick", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  annual: { label: "Annual", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  emergency: { label: "Emergency", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  maternity: { label: "Maternity", className: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  unpaid: { label: "Unpaid", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
};

export function LeaveStatusBadge({ kind, value }: LeaveStatusBadgeProps) {
  if (kind === "status") {
    const config = statusConfig[value as LeaveStatus];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  const config = typeConfig[value as LeaveType] || {
    label: LEAVE_TYPE_LABELS[value] || value,
    className: "",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
