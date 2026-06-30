"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, Copy, Check } from "lucide-react";
import { registerOrganization, registerStaffMember, signInUser } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/constants";
import { toast } from "sonner";

interface SignUpPanelProps {
  tab: "organization" | "staff";
  onTabChange: (tab: "organization" | "staff") => void;
  onSwitchToSignIn: () => void;
}

type SuccessState = {
  title: string;
  message: string;
  inviteCode?: string;
  redirectTo: string;
  buttonLabel: string;
};

async function completeSignIn(
  email: string,
  password: string,
  redirectTo: string
): Promise<{ error?: string }> {
  const signIn = await signInUser(email, password);
  if (signIn.error) return { error: signIn.error };
  window.location.href = redirectTo;
  return {};
}

export function SignUpPanel({ tab, onTabChange, onSwitchToSignIn }: SignUpPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  const [orgForm, setOrgForm] = useState({
    organizationName: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [staffForm, setStaffForm] = useState({
    inviteCode: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
  });

  const handleOrgRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (orgForm.password !== orgForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await registerOrganization({
        organizationName: orgForm.organizationName,
        fullName: orgForm.fullName,
        email: orgForm.email,
        password: orgForm.password,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess({
        title: "Organization created",
        message: `${orgForm.organizationName.trim()} is ready. Share the invite code below so staff can join.`,
        inviteCode: result.inviteCode,
        redirectTo: "/dashboard?welcome=1",
        buttonLabel: "Go to Admin Dashboard",
      });
      toast.success("Organization created successfully");
    } finally {
      setLoading(false);
    }
  };

  const handleStaffRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (staffForm.password !== staffForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!staffForm.department) {
      setError("Department is required");
      return;
    }
    setLoading(true);
    try {
      const result = await registerStaffMember({
        inviteCode: staffForm.inviteCode,
        fullName: staffForm.fullName,
        email: staffForm.email,
        password: staffForm.password,
        department: staffForm.department,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess({
        title: "Welcome aboard",
        message: `You joined ${result.organizationName}. Complete face enrollment next so video check-in can verify you.`,
        redirectTo: "/profile?enroll=1",
        buttonLabel: "Enroll Face & Continue",
      });
      toast.success(`Welcome to ${result.organizationName}!`);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!success) return;
    setLoading(true);
    setError("");
    const email = tab === "organization" ? orgForm.email : staffForm.email;
    const password = tab === "organization" ? orgForm.password : staffForm.password;
    const result = await completeSignIn(email, password, success.redirectTo);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!success?.inviteCode) return;
    await navigator.clipboard.writeText(success.inviteCode);
    setCopied(true);
    toast.success("Invite code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{success.title}</h2>
          <p className="text-sm text-muted-foreground">{success.message}</p>
        </div>
        {success.inviteCode && (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <p className="text-sm font-medium">Staff invite code</p>
            <code className="block text-lg font-mono font-semibold tracking-widest">
              {success.inviteCode}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={handleCopyInvite}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
        )}
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            {error}
          </div>
        )}
        <Button type="button" className="w-full" onClick={handleContinue} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {success.buttonLabel}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as "organization" | "staff")}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="organization">Register Organization</TabsTrigger>
          <TabsTrigger value="staff">Join as Staff</TabsTrigger>
        </TabsList>

        {error && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        <TabsContent value="organization">
          <form onSubmit={handleOrgRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Acme Corporation"
                value={orgForm.organizationName}
                onChange={(e) => setOrgForm({ ...orgForm, organizationName: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-name">Your Full Name</Label>
              <Input
                id="admin-name"
                placeholder="Jane Smith"
                value={orgForm.fullName}
                onChange={(e) => setOrgForm({ ...orgForm, fullName: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Work Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@company.com"
                value={orgForm.email}
                onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={orgForm.password}
                  onChange={(e) => setOrgForm({ ...orgForm, password: e.target.value })}
                  disabled={loading}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirm">Confirm Password</Label>
              <Input
                id="admin-confirm"
                type="password"
                value={orgForm.confirmPassword}
                onChange={(e) => setOrgForm({ ...orgForm, confirmPassword: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Organization
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You become the admin. Share the invite code with staff after signup.
            </p>
          </form>
        </TabsContent>

        <TabsContent value="staff">
          <form onSubmit={handleStaffRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Organization Invite Code</Label>
              <Input
                id="invite-code"
                placeholder="AB12CD34"
                value={staffForm.inviteCode}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, inviteCode: e.target.value.toUpperCase() })
                }
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">Ask your organization admin for this code.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full Name</Label>
              <Input
                id="staff-name"
                value={staffForm.fullName}
                onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-dept">Department</Label>
              <Select
                value={staffForm.department}
                onValueChange={(v) => setStaffForm({ ...staffForm, department: v })}
              >
                <SelectTrigger id="staff-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-confirm">Confirm Password</Label>
              <Input
                id="staff-confirm"
                type="password"
                value={staffForm.confirmPassword}
                onChange={(e) => setStaffForm({ ...staffForm, confirmPassword: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Join Organization
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </button>
      </p>
    </>
  );
}
