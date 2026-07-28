"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { updateAttendanceSecuritySettings } from "@/lib/actions/organization";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BIOMETRIC_PROVIDER_HINTS,
  BIOMETRIC_PROVIDER_LABELS,
  BIOMETRIC_PROVIDERS,
  normalizeBiometricProvider,
  type BiometricProvider,
} from "@/lib/biometrics/providers";
import type { AttendanceMode } from "@/lib/types";

interface BiometricProviderCardProps {
  organization: {
    attendance_mode?: string | null;
    office_latitude?: number | null;
    office_longitude?: number | null;
    geofence_radius_m?: number | null;
    require_video_verification?: boolean | null;
    require_face_match?: boolean | null;
    require_geofence?: boolean | null;
    require_qr_code?: boolean | null;
    biometric_provider?: string | null;
  };
}

export function BiometricProviderCard({ organization }: BiometricProviderCardProps) {
  const [provider, setProvider] = useState<BiometricProvider>(
    normalizeBiometricProvider(organization.biometric_provider || "aws")
  );
  const [availability, setAvailability] = useState({ local: true, didit: false, aws: false });
  const [awsStatus, setAwsStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    livenessConfigured?: boolean;
    message?: string;
    region?: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [availabilityRes, awsRes] = await Promise.all([
          fetch("/api/admin/biometric-availability"),
          fetch("/api/admin/aws/status"),
        ]);
        if (cancelled) return;
        const availabilityData = (await availabilityRes.json()) as {
          local?: boolean;
          didit?: boolean;
          aws?: boolean;
        };
        setAvailability({
          local: availabilityData.local !== false,
          didit: !!availabilityData.didit,
          aws: !!availabilityData.aws,
        });
        setAwsStatus((await awsRes.json()) as typeof awsStatus);
      } catch {
        if (!cancelled) setAwsStatus(null);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (provider === "didit" && !availability.didit) {
      toast.error("Didit is not configured (DIDIT_API_KEY / DIDIT_WORKFLOW_ID on Vercel).");
      return;
    }
    if (provider === "aws" && !availability.aws) {
      toast.error(
        "AWS is not configured. Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION to Vercel — see BIOMETRIC_SETUP.md."
      );
      return;
    }

    setSaving(true);
    const mode = (organization.attendance_mode as AttendanceMode) || "standard";
    const result = await updateAttendanceSecuritySettings({
      attendanceMode: mode,
      officeLatitude: organization.office_latitude ?? null,
      officeLongitude: organization.office_longitude ?? null,
      geofenceRadiusM: organization.geofence_radius_m ?? 150,
      requireVideoVerification: organization.require_video_verification ?? true,
      requireFaceMatch: organization.require_face_match ?? true,
      requireGeofence: organization.require_geofence ?? false,
      requireQrCode: organization.require_qr_code ?? false,
      biometricProvider: provider,
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Face verification method saved");
  };

  const awsConnected = awsStatus?.configured && awsStatus.ok;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanFace className="h-4 w-4" />
          Face verification
        </CardTitle>
        <CardDescription className="text-xs">
          How staff prove identity at signup and kiosk clock-in. Setup:{" "}
          <code className="rounded bg-muted px-1">BIOMETRIC_SETUP.md</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statusLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking AWS connection…
          </div>
        ) : awsConnected ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              AWS connected ({awsStatus?.region}).{" "}
              {awsStatus?.livenessConfigured
                ? "Face Liveness enabled."
                : "Motion liveness active — add Cognito pool for AWS Face Liveness."}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {awsStatus?.message ||
                "AWS keys missing on this server. Add them on Vercel and redeploy."}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="biometric-provider" className="text-xs">
              Method
            </Label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as BiometricProvider)}
            >
              <SelectTrigger id="biometric-provider" className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIOMETRIC_PROVIDERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {BIOMETRIC_PROVIDER_LABELS[option]}
                    {option === "didit" && !availability.didit ? " · not configured" : ""}
                    {option === "aws" && !availability.aws ? " · not configured" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px]">{BIOMETRIC_PROVIDER_HINTS[provider]}</p>
          </div>
          <Button type="button" size="sm" className="sm:mb-5" onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
