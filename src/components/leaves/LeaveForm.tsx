"use client";

import { useMemo, useState } from "react";
import { differenceInBusinessDays, format } from "date-fns";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_BALANCE, LEAVE_TYPE_LABELS } from "@/constants";
import { applyForLeave } from "@/lib/actions/leaves";
import type { Leave, LeaveType } from "@/lib/types";

interface LeaveFormProps {
  staffId?: string;
  onSuccess?: () => void;
  onLeaveSubmitted?: (leave: Leave) => void;
}

interface FormState {
  leave_type: LeaveType | "";
  start_date: string;
  end_date: string;
  reason: string;
}

interface FormErrors {
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
}

const LEAVE_TYPES = Object.keys(LEAVE_TYPE_LABELS) as LeaveType[];

function validateForm(data: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!data.leave_type) errors.leave_type = "Leave type is required";
  if (!data.start_date) errors.start_date = "Start date is required";
  if (!data.end_date) errors.end_date = "End date is required";
  if (data.start_date && data.end_date && new Date(data.end_date) < new Date(data.start_date)) {
    errors.end_date = "End date must be on or after start date";
  }
  if (!data.reason.trim()) {
    errors.reason = "Reason is required";
  } else if (data.reason.trim().length < 10) {
    errors.reason = "Please provide at least 10 characters";
  }
  return errors;
}

export function LeaveForm({ onSuccess, onLeaveSubmitted }: LeaveFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    if (new Date(form.end_date) < new Date(form.start_date)) return 0;
    return differenceInBusinessDays(new Date(form.end_date), new Date(form.start_date)) + 1;
  }, [form.start_date, form.end_date]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSubmitting(true);
    const result = await applyForLeave({
      leave_type: form.leave_type as LeaveType,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
    });
    setIsSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Leave request submitted successfully");
    setForm({ leave_type: "", start_date: "", end_date: "", reason: "" });
    setOpen(false);
    if (result.leave) onLeaveSubmitted?.(result.leave);
    onSuccess?.();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Apply for Leave
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription>Submit a new leave request for admin approval.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="leave_type">Leave Type</Label>
        <Select
          value={form.leave_type}
          onValueChange={(value) => updateField("leave_type", value as LeaveType)}
        >
          <SelectTrigger id="leave_type">
            <SelectValue placeholder="Select leave type" />
          </SelectTrigger>
          <SelectContent>
            {LEAVE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {LEAVE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.leave_type && <p className="text-sm text-destructive">{errors.leave_type}</p>}
        <p className="text-xs text-muted-foreground">
          Annual allowance: {LEAVE_BALANCE.annual} days · Sick allowance: {LEAVE_BALANCE.sick} days
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date</Label>
          <Input
            id="start_date"
            type="date"
            value={form.start_date}
            min={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => updateField("start_date", e.target.value)}
          />
          {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date</Label>
          <Input
            id="end_date"
            type="date"
            value={form.end_date}
            min={form.start_date || format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => updateField("end_date", e.target.value)}
          />
          {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
        </div>
      </div>
      {estimatedDays > 0 && (
        <p className="text-sm text-muted-foreground">
          Estimated working days: <span className="font-medium text-foreground">{estimatedDays}</span>
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Textarea
          id="reason"
          placeholder="Describe the reason for your leave request..."
          value={form.reason}
          onChange={(e) => updateField("reason", e.target.value)}
          rows={4}
        />
        {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Leave Request
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
