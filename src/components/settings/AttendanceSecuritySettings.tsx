"use client";

import { useState } from "react";
import { Loader2, MapPin, Shield } from "lucide-react";
import { toast } from "sonner";
import { updateAttendanceSecuritySettings } from "@/lib/actions/organization";
import { presetTogglesForMode } from "@/lib/utils/securityPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ATTENDANCE_MODE_LABELS, ATTENDANCE_MODES } from "@/constants";
import type { AttendanceMode } from "@/lib/types";

interface AttendanceSecuritySettingsProps {
  initial: {
    attendance_mode?: string | null;
    office_latitude?: number | null;
    office_longitude?: number | null;
    geofence_radius_m?: number | null;
    require_video_verification?: boolean | null;
    require_face_match?: boolean | null;
    require_geofence?: boolean | null;
    require_qr_code?: boolean | null;
  };
}

export function AttendanceSecuritySettings({ initial }: AttendanceSecuritySettingsProps) {
  const initialMode = (initial.attendance_mode as AttendanceMode) || "standard";
  const initialPreset = presetTogglesForMode(initialMode);

  const [mode, setMode] = useState<AttendanceMode>(initialMode);
  const [requireVideo, setRequireVideo] = useState(
    initial.require_video_verification ?? initialPreset.requireVideoVerification
  );
  const [requireFace, setRequireFace] = useState(
    initial.require_face_match ?? initialPreset.requireFaceMatch
  );
  const [requireGeofence, setRequireGeofence] = useState(
    initial.require_geofence ?? initialPreset.requireGeofence
  );
  const [requireQr, setRequireQr] = useState(
    initial.require_qr_code ?? initialPreset.requireQrCode
  );
  const [latitude, setLatitude] = useState(
    initial.office_latitude != null ? String(initial.office_latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    initial.office_longitude != null ? String(initial.office_longitude) : ""
  );
  const [radius, setRadius] = useState(String(initial.geofence_radius_m ?? 150));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const applyModePreset = (nextMode: AttendanceMode) => {
    setMode(nextMode);
    const preset = presetTogglesForMode(nextMode);
    setRequireVideo(preset.requireVideoVerification);
    setRequireFace(preset.requireFaceMatch);
    setRequireGeofence(preset.requireGeofence);
    setRequireQr(preset.requireQrCode);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Office coordinates captured from this device");
      },
      () => {
        setLocating(false);
        toast.error("Could not read your location");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateAttendanceSecuritySettings({
      attendanceMode: mode,
      officeLatitude: latitude.trim() ? Number(latitude) : null,
      officeLongitude: longitude.trim() ? Number(longitude) : null,
      geofenceRadiusM: Number(radius) || 150,
      requireVideoVerification: requireVideo,
      requireFaceMatch: requireFace,
      requireGeofence: requireGeofence,
      requireQrCode: requireQr,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Attendance security settings saved");
  };

  const needsOfficeLocation = requireGeofence || requireQr;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Attendance Security
        </CardTitle>
        <CardDescription>
          Video and face verification are the primary anti-cheat controls. Toggle each feature for your workplace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Quick preset</Label>
          <Select value={mode} onValueChange={(value) => applyModePreset(value as AttendanceMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTENDANCE_MODES.map((option) => (
                <SelectItem key={option} value={option}>
                  {ATTENDANCE_MODE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox checked={requireVideo} onCheckedChange={(v) => setRequireVideo(!!v)} />
            <span>
              <span className="block text-sm font-medium">Live video liveness</span>
              <span className="text-xs text-muted-foreground">Required for check-in and check-out</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox checked={requireFace} onCheckedChange={(v) => setRequireFace(!!v)} />
            <span>
              <span className="block text-sm font-medium">Face match</span>
              <span className="text-xs text-muted-foreground">Staff must enroll in Profile first</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox checked={requireGeofence} onCheckedChange={(v) => setRequireGeofence(!!v)} />
            <span>
              <span className="block text-sm font-medium">Office geofence</span>
              <span className="text-xs text-muted-foreground">GPS must be within office radius</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox checked={requireQr} onCheckedChange={(v) => setRequireQr(!!v)} />
            <span>
              <span className="block text-sm font-medium">Reception QR / desk code</span>
              <span className="text-xs text-muted-foreground">Show QR on Attendance page at reception</span>
            </span>
          </label>
        </div>

        {needsOfficeLocation && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="office-lat">Office latitude</Label>
              <Input
                id="office-lat"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 37.774929"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-lng">Office longitude</Label>
              <Input
                id="office-lng"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. -122.419416"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="geofence-radius">Geofence radius (meters)</Label>
              <Input
                id="geofence-radius"
                type="number"
                min={50}
                max={5000}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={useCurrentLocation}
              disabled={locating}
              className="sm:col-span-2 w-full sm:w-auto"
            >
              {locating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              Use this device&apos;s location as office
            </Button>
          </div>
        )}

        {requireQr && (
          <p className="text-sm text-muted-foreground">
            Open Attendance on a reception tablet to display the rotating QR code staff must scan at check-in.
          </p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Security Settings
        </Button>
      </CardContent>
    </Card>
  );
}
