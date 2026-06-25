"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEAVE_TYPE_LABELS } from "@/constants";
import { cancelLeave, reviewLeave } from "@/lib/actions/leaves";
import { formatDate } from "@/lib/utils/formatDate";
import { LeaveStatusBadge } from "@/components/leaves/LeaveStatusBadge";
import type { Leave, LeaveType } from "@/lib/types";

interface LeaveTableProps {
  leaves: Leave[];
  isAdmin?: boolean;
  showStaff?: boolean;
  allowCancel?: boolean;
  onLeaveUpdated?: (leaveId: string, updates: Partial<Leave>) => void;
  onLeaveRemoved?: (leaveId: string) => void;
}

type ReviewAction = "approved" | "rejected";

function LeaveMobileCard({
  leave,
  isAdmin,
  showStaff,
  allowCancel,
  onApprove,
  onReject,
  onCancel,
  isCancelling,
}: {
  leave: Leave;
  isAdmin?: boolean;
  showStaff?: boolean;
  allowCancel?: boolean;
  onApprove: (leave: Leave) => void;
  onReject: (leave: Leave) => void;
  onCancel: (leaveId: string) => void;
  isCancelling: string | null;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3 md:hidden">
      {showStaff && (
        <p className="font-medium">{leave.profiles?.full_name || "—"}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <LeaveStatusBadge kind="type" value={leave.leave_type} />
        <LeaveStatusBadge kind="status" value={leave.status} />
      </div>
      <div className="text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Period: </span>
          {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
        </p>
        <p>
          <span className="text-muted-foreground">Days: </span>
          {leave.total_days}
        </p>
        <p className="line-clamp-3">
          <span className="text-muted-foreground">Reason: </span>
          {leave.reason}
        </p>
        <p className="text-muted-foreground text-xs">Submitted {formatDate(leave.created_at)}</p>
      </div>
      {isAdmin && leave.status === "pending" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-green-600"
            onClick={() => onApprove(leave)}
          >
            <Check className="mr-1 h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-destructive"
            onClick={() => onReject(leave)}
          >
            <X className="mr-1 h-3 w-3" />
            Reject
          </Button>
        </div>
      )}
      {allowCancel && leave.status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full text-destructive"
          disabled={isCancelling === leave.id}
          onClick={() => onCancel(leave.id)}
        >
          {isCancelling === leave.id ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          Cancel Request
        </Button>
      )}
    </div>
  );
}

export function LeaveTable({
  leaves,
  isAdmin = false,
  showStaff = true,
  allowCancel = false,
  onLeaveUpdated,
  onLeaveRemoved,
}: LeaveTableProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<Leave | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leaves.filter((leave) => {
      const matchesStatus = statusFilter === "all" || leave.status === statusFilter;
      const matchesType = typeFilter === "all" || leave.leave_type === typeFilter;
      const staffName = leave.profiles?.full_name?.toLowerCase() || "";
      const matchesSearch =
        !query || staffName.includes(query) || leave.reason.toLowerCase().includes(query);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [leaves, statusFilter, typeFilter, search]);

  const openReviewDialog = (leave: Leave, action: ReviewAction) => {
    setReviewTarget(leave);
    setReviewAction(action);
    setAdminNote("");
  };

  const closeReviewDialog = () => {
    setReviewTarget(null);
    setReviewAction(null);
    setAdminNote("");
  };

  const handleReview = async () => {
    if (!reviewTarget || !reviewAction) return;
    setIsReviewing(true);
    onLeaveUpdated?.(reviewTarget.id, {
      status: reviewAction,
      admin_note: adminNote.trim() || undefined,
      reviewed_at: new Date().toISOString(),
    });
    const result = await reviewLeave(reviewTarget.id, reviewAction, adminNote.trim() || undefined);
    setIsReviewing(false);
    if (result.error) {
      onLeaveUpdated?.(reviewTarget.id, { status: "pending" });
      toast.error(result.error);
      return;
    }
    toast.success(`Leave request ${reviewAction}`);
    closeReviewDialog();
    router.refresh();
  };

  const handleCancel = async (leaveId: string) => {
    setCancellingId(leaveId);
    onLeaveRemoved?.(leaveId);
    const result = await cancelLeave(leaveId);
    setCancellingId(null);
    if (result.error) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Leave request cancelled");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by staff or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {LEAVE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No leave requests found.</p>
        ) : (
          filtered.map((leave) => (
            <LeaveMobileCard
              key={leave.id}
              leave={leave}
              isAdmin={isAdmin}
              showStaff={showStaff}
              allowCancel={allowCancel}
              onApprove={(item) => openReviewDialog(item, "approved")}
              onReject={(item) => openReviewDialog(item, "rejected")}
              onCancel={handleCancel}
              isCancelling={cancellingId}
            />
          ))
        )}
      </div>

      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {showStaff && <TableHead>Staff</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              {(isAdmin || allowCancel) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    (showStaff ? 7 : 6) + (isAdmin || allowCancel ? 1 : 0)
                  }
                  className="h-24 text-center text-muted-foreground"
                >
                  No leave requests found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((leave) => (
                <TableRow key={leave.id}>
                  {showStaff && (
                    <TableCell className="font-medium">
                      {leave.profiles?.full_name || "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <LeaveStatusBadge kind="type" value={leave.leave_type} />
                  </TableCell>
                  <TableCell>
                    {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
                  </TableCell>
                  <TableCell>{leave.total_days}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge kind="status" value={leave.status} />
                  </TableCell>
                  <TableCell>{formatDate(leave.created_at)}</TableCell>
                  {(isAdmin || allowCancel) && (
                    <TableCell className="text-right">
                      {isAdmin && leave.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => openReviewDialog(leave, "approved")}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openReviewDialog(leave, "rejected")}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      ) : allowCancel && leave.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={cancellingId === leave.id}
                          onClick={() => handleCancel(leave.id)}
                        >
                          {cancellingId === leave.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1 h-3 w-3" />
                          )}
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && closeReviewDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
            <DialogDescription>
              {reviewTarget?.profiles?.full_name} — {reviewTarget && formatDate(reviewTarget.start_date)}{" "}
              to {reviewTarget && formatDate(reviewTarget.end_date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-note">Admin Note (optional)</Label>
            <Textarea
              id="admin-note"
              placeholder="Add a note for the staff member..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeReviewDialog} disabled={isReviewing} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={isReviewing}
              variant={reviewAction === "rejected" ? "destructive" : "default"}
              className="w-full sm:w-auto"
            >
              {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {reviewAction === "approved" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
