"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Copy, Loader2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEPARTMENTS } from "@/constants";
import { createStaffMember, updateStaffMember } from "@/lib/actions/staff";
import type { Profile, Role } from "@/lib/types";

interface StaffFormProps {
  profile?: Profile;
  onSuccess?: () => void;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: Role;
  date_joined: string;
}

interface FormErrors {
  full_name?: string;
  email?: string;
  department?: string;
  date_joined?: string;
}

function validateForm(data: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!data.full_name.trim()) errors.full_name = "Full name is required";
  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!data.department) errors.department = "Department is required";
  if (!data.date_joined) errors.date_joined = "Date joined is required";
  return errors;
}

export function StaffForm({ profile, onSuccess }: StaffFormProps) {
  const router = useRouter();
  const isEdit = !!profile;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    full_name: profile?.full_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    department: profile?.department || "",
    role: profile?.role || "staff",
    date_joined: profile?.date_joined || format(new Date(), "yyyy-MM-dd"),
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

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
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      department: form.department,
      role: form.role,
      date_joined: form.date_joined,
    };
    const result = isEdit
      ? await updateStaffMember(profile!.id, payload)
      : await createStaffMember(payload);
    setIsSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (
      !isEdit &&
      result.success &&
      "password" in result &&
      typeof result.password === "string"
    ) {
      setGeneratedPassword(result.password);
      toast.success("Staff member created successfully");
      return;
    }
    toast.success(isEdit ? "Staff member updated successfully" : "Staff member created successfully");
    setOpen(false);
    onSuccess?.();
    router.push(isEdit ? `/staff/${profile!.id}` : "/staff");
    router.refresh();
  };

  const handleCopyPassword = async () => {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    toast.success("Password copied to clipboard");
  };

  const handlePasswordDialogClose = () => {
    setGeneratedPassword(null);
    setOpen(false);
    onSuccess?.();
    router.push("/staff");
    router.refresh();
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            placeholder="John Doe"
          />
          {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="john@school.edu"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="+1 234 567 8900"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Select value={form.department} onValueChange={(value) => updateField("department", value)}>
            <SelectTrigger id="department">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.department && <p className="text-sm text-destructive">{errors.department}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={form.role} onValueChange={(value) => updateField("role", value as Role)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_joined">Date Joined</Label>
          <Input
            id="date_joined"
            type="date"
            value={form.date_joined}
            onChange={(e) => updateField("date_joined", e.target.value)}
          />
          {errors.date_joined && <p className="text-sm text-destructive">{errors.date_joined}</p>}
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update Staff" : "Create Staff"}
          </Button>
          {!isEdit && (
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
          {isEdit && (
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          )}
        </div>
      </form>
  );

  return (
    <>
      {!isEdit ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}>Add Staff</Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>Create a new staff account with login credentials.</DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Edit Profile
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>Update staff profile details.</DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!generatedPassword} onOpenChange={(open) => !open && handlePasswordDialogClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Staff Account Created</DialogTitle>
            <DialogDescription>
              Share this temporary password with the new staff member. They should change it after
              first login.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
            <code className="flex-1 text-sm font-mono break-all">{generatedPassword}</code>
            <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy password</span>
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={handlePasswordDialogClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
