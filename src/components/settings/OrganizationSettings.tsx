"use client";

import { useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { regenerateInviteCode, updateOrganizationName } from "@/lib/actions/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceSecuritySettings } from "@/components/settings/AttendanceSecuritySettings";
import { KioskManagement } from "@/components/settings/KioskManagement";
import { LEAVE_BALANCE } from "@/constants";

interface OrganizationSettingsProps {
  organization: {
    id: string;
    name: string;
    invite_code: string;
    slug: string;
    created_at: string;
    attendance_mode?: string | null;
    office_latitude?: number | null;
    office_longitude?: number | null;
    geofence_radius_m?: number | null;
    require_video_verification?: boolean | null;
    require_face_match?: boolean | null;
    require_geofence?: boolean | null;
    require_qr_code?: boolean | null;
  };
  kiosks?: {
    id: string;
    device_name: string;
    location: string | null;
    is_active: boolean;
    last_seen_at: string | null;
    created_at: string;
  }[];
}

export function OrganizationSettings({ organization, kiosks = [] }: OrganizationSettingsProps) {
  const [name, setName] = useState(organization.name);
  const [inviteCode, setInviteCode] = useState(organization.invite_code);
  const [savingName, setSavingName] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleSaveName = async () => {
    setSavingName(true);
    const result = await updateOrganizationName(name);
    setSavingName(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Organization name updated");
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    const result = await regenerateInviteCode();
    setRegenerating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if ("inviteCode" in result && result.inviteCode) setInviteCode(result.inviteCode);
    toast.success("New invite code generated");
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Organization Settings</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage your organization profile, staff onboarding, and leave policies
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Update how your organization appears in AttendPro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveName} disabled={savingName || name.trim() === organization.name}>
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Name
            </Button>
            <p className="text-xs text-muted-foreground">Slug: {organization.slug}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff Invite Code</CardTitle>
            <CardDescription>Share this code so staff can join via Sign Up → Join as Staff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <code className="block rounded-lg border bg-muted/40 p-4 text-center text-xl font-mono tracking-widest">
              {inviteCode}
            </code>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={copyCode} className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              <Button variant="outline" onClick={handleRegenerateCode} disabled={regenerating} className="flex-1">
                {regenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>

        <AttendanceSecuritySettings
          initial={{
            attendance_mode: organization.attendance_mode,
            office_latitude: organization.office_latitude,
            office_longitude: organization.office_longitude,
            geofence_radius_m: organization.geofence_radius_m,
            require_video_verification: organization.require_video_verification,
            require_face_match: organization.require_face_match,
            require_geofence: organization.require_geofence,
            require_qr_code: organization.require_qr_code,
          }}
        />

        <KioskManagement initialKiosks={kiosks} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leave Policy (Default)</CardTitle>
            <CardDescription>Applied to all staff unless customized per plan in a future release</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="font-medium">Annual Leave</p>
              <p className="text-2xl font-bold text-primary">{LEAVE_BALANCE.annual} days</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-medium">Sick Leave</p>
              <p className="text-2xl font-bold text-primary">{LEAVE_BALANCE.sick} days</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
