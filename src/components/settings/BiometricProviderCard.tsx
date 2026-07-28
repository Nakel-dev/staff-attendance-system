"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { updateAttendanceSecuritySettings } from "@/lib/actions/organization";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
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

/**
 * Standalone admin control for which face engine staff/kiosk use.
 * Default deployment: AWS Rekognition (see BIOMETRIC_SETUP.md).
 */
export function BiometricProviderCard({ organization }: BiometricProviderCardProps) {
  const [provider, setProvider] = useState<BiometricProvider>(
    normalizeBiometricProvider(organization.biometric_provider || "aws")
  );
  const [availability, setAvailability] = useState({ local: true, didit: false, aws: false });
  const [awsStatus, setAwsStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    message?: string;
    region?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/biometric-availability")
      .then((r) => r.json())
      .then((d: { local?: boolean; didit?: boolean; aws?: boolean }) => {
        setAvailability({
          local: d.local !== false,
          didit: !!d.didit,
          aws: !!d.aws,
        });
      })
      .catch(() => undefined);

    void fetch("/api/admin/aws/status")
      .then((r) => r.json())
      .then((d: { ok?: boolean; message?: string; region?: string; configured?: boolean }) => {
        setAwsStatus(d);
      })
      .catch(() => undefined);
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

  return (
    <Card className="border-primary/40 bg-primary/5 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScanFace className="h-5 w-5" />
          Face verification method (clock-in)
        </CardTitle>
        <CardDescription>
          Production default: <strong>AWS Rekognition</strong>. Staff camera photo at signup is
          compared at every clock-in. One-time AWS setup: see <code>BIOMETRIC_SETUP.md</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {awsStatus?.configured && awsStatus.ok && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>AWS Rekognition connected</AlertTitle>
            <AlertDescription>
              Region {awsStatus.region}. {awsStatus.message}
            </AlertDescription>
          </Alert>
        )}

        {(!awsStatus?.configured || awsStatus?.ok === false) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>AWS not ready on this server</AlertTitle>
            <AlertDescription>
              {awsStatus?.message ||
                "Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION to Vercel, redeploy, then run migration 015 in Supabase."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="biometric-provider">Provider</Label>
          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as BiometricProvider)}
          >
            <SelectTrigger id="biometric-provider" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BIOMETRIC_PROVIDERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {BIOMETRIC_PROVIDER_LABELS[option]}
                  {option === "didit" && !availability.didit ? " — not configured on server" : ""}
                  {option === "aws" && !availability.aws ? " — not configured on server" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>
            <strong>AWS</strong> (recommended): signup photo + live face at kiosk (~$0.001/compare)
          </li>
          <li>
            <strong>Local</strong>: free on-device only — no cloud match
          </li>
          <li>
            <strong>Didit</strong>: optional third-party liveness
          </li>
        </ul>

        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save face verification method
        </Button>
      </CardContent>
    </Card>
  );
}
