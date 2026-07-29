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
  const [provider, setProvider] = useState<BiometricProvider>(() =>
    normalizeBiometricProvider(organization.biometric_provider)
  );

  useEffect(() => {
    setProvider(normalizeBiometricProvider(organization.biometric_provider));
  }, [organization.biometric_provider]);
  const [availability, setAvailability] = useState({
    local: true,
    didit: false,
    faceplusplus: false,
  });
  const [faceppStatus, setFaceppStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    message?: string;
    confidenceThreshold?: number;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [availabilityRes, faceppRes] = await Promise.all([
          fetch("/api/admin/biometric-availability"),
          fetch("/api/admin/faceplusplus/status"),
        ]);
        if (cancelled) return;
        const availabilityData = (await availabilityRes.json()) as {
          local?: boolean;
          didit?: boolean;
          faceplusplus?: boolean;
        };
        setAvailability({
          local: availabilityData.local !== false,
          didit: !!availabilityData.didit,
          faceplusplus: !!availabilityData.faceplusplus,
        });
        setFaceppStatus((await faceppRes.json()) as typeof faceppStatus);
      } catch {
        if (!cancelled) setFaceppStatus(null);
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
      toast.error("Didit is not configured (DIDIT_API_KEY / DIDIT_WORKFLOW_ID).");
      return;
    }
    if (provider === "faceplusplus" && !availability.faceplusplus) {
      toast.error(
        "Face++ is not configured. Add FACEPP_API_KEY and FACEPP_API_SECRET — see FACEPP_SETUP.md."
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

  const faceppConnected = faceppStatus?.configured && faceppStatus.ok;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanFace className="h-4 w-4" />
          Face verification
        </CardTitle>
        <CardDescription className="text-xs">
          How staff verify identity in the portal and at the kiosk. Setup:{" "}
          <code className="rounded bg-muted px-1">FACEPP_SETUP.md</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {provider === "faceplusplus" && (
          <>
            {statusLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking Face++ connection…
              </div>
            ) : faceppConnected ? (
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Face++ connected. Match threshold: {faceppStatus?.confidenceThreshold ?? 70}%.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {faceppStatus?.message ||
                    "Face++ keys missing. Add FACEPP_API_KEY and FACEPP_API_SECRET to .env.local."}
                </span>
              </div>
            )}
          </>
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
                <SelectValue placeholder="Choose method">
                  {BIOMETRIC_PROVIDER_LABELS[provider]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BIOMETRIC_PROVIDERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {BIOMETRIC_PROVIDER_LABELS[option]}
                    {option === "didit" && !availability.didit ? " · not configured" : ""}
                    {option === "faceplusplus" && !availability.faceplusplus
                      ? " · not configured"
                      : ""}
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
