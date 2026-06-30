"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogIn,
  MapPin,
  ScanFace,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ATTENDANCE_MODE_LABELS } from "@/constants";
import { checkInStaff, checkOutStaff } from "@/lib/actions/attendance";
import { getStaffCheckInPolicy } from "@/lib/actions/organization";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils/formatDate";
import { QrCheckInScanner } from "@/components/attendance/QrCheckInScanner";
import {
  VideoVerificationCapture,
  type VideoVerificationResult,
} from "@/components/attendance/VideoVerificationCapture";
import type { Attendance, AttendanceMode } from "@/lib/types";

interface CheckInPolicy {
  mode: AttendanceMode;
  geofenceRadiusM: number;
  hasOfficeLocation: boolean;
  requiresPhoto: boolean;
  requiresVideo: boolean;
  requiresQr: boolean;
  requiresFaceMatch: boolean;
  faceEnrolled: boolean;
  selfCheckInEnabled: boolean;
  officeConfiguredForSecureMode: boolean;
}

interface StaffCheckInPanelProps {
  todayRecord?: Attendance | null;
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(error.message || "Unable to read your location"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function StaffCheckInPanel({ todayRecord }: StaffCheckInPanelProps) {
  const router = useRouter();
  const [localTodayRecord, setLocalTodayRecord] = useState(todayRecord);
  const [policy, setPolicy] = useState<CheckInPolicy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [verification, setVerification] = useState<VideoVerificationResult | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    setLocalTodayRecord(todayRecord);
  }, [todayRecord]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingPolicy(true);
      const result = await getStaffCheckInPolicy();
      if (!active) return;
      if ("error" in result) {
        toast.error(result.error);
        setLoadingPolicy(false);
        return;
      }
      setPolicy(result.policy);
      setLoadingPolicy(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const uploadVideo = useCallback(async (file: Blob, userId: string) => {
    const supabase = createClient();
    const path = `${userId}/checkin-${Date.now()}.webm`;
    const { error } = await supabase.storage.from("check-in-videos").upload(path, file, {
      contentType: file.type || "video/webm",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return path;
  }, []);

  const handleCheckIn = async () => {
    if (!policy) return;
    setIsCheckingIn(true);
    setLocationStatus(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to check in");
        return;
      }

      let latitude: number | undefined;
      let longitude: number | undefined;
      let videoPath: string | undefined;

      if (policy.requiresVideo) {
        if (!verification) {
          toast.error("Complete the video liveness verification first");
          return;
        }
        videoPath = await uploadVideo(verification.videoBlob, user.id);
      }

      if (policy.requiresQr && !qrToken.trim()) {
        toast.error("Scan the reception QR code before checking in");
        return;
      }

      if (policy.mode === "standard" || policy.mode === "strict" || policy.mode === "trust") {
        try {
          const coords = await getLocation();
          latitude = coords.latitude;
          longitude = coords.longitude;
          setLocationStatus(
            `Location captured (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`
          );
        } catch (locationError) {
          if (policy.mode !== "trust") {
            toast.error(
              locationError instanceof Error
                ? locationError.message
                : "Location is required"
            );
            return;
          }
        }
      }

      const optimisticTime = format(new Date(), "HH:mm:ss");
      setLocalTodayRecord((prev) => ({
        id: prev?.id || "temp",
        staff_id: prev?.staff_id || "",
        date: format(new Date(), "yyyy-MM-dd"),
        status: "present",
        check_in_time: optimisticTime,
        check_out_time: prev?.check_out_time,
        created_at: prev?.created_at || new Date().toISOString(),
      }));

      const result = await checkInStaff({
        latitude,
        longitude,
        videoPath,
        qrToken: policy.requiresQr ? qrToken : undefined,
        faceDescriptor: verification?.faceDescriptor,
        frameDescriptors: verification?.frameDescriptors,
        motionScore: verification?.motionScore,
      });

      if ("error" in result) {
        setLocalTodayRecord(todayRecord);
        toast.error(result.error);
        return;
      }

      toast.success(
        result.flagged
          ? `Checked in at ${result.checkInTime ? formatTime(result.checkInTime) : "now"} (flagged for review)`
          : `Checked in at ${result.checkInTime ? formatTime(result.checkInTime) : "now"}`
      );
      router.refresh();
    } catch (err) {
      setLocalTodayRecord(todayRecord);
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setIsCheckingOut(true);
    const optimisticTime = format(new Date(), "HH:mm:ss");
    setLocalTodayRecord((prev) =>
      prev ? { ...prev, check_out_time: optimisticTime } : prev
    );
    const result = await checkOutStaff();
    setIsCheckingOut(false);
    if (result.error) {
      setLocalTodayRecord(todayRecord);
      toast.error(result.error);
      return;
    }
    toast.success(`Checked out at ${result.checkOutTime ? formatTime(result.checkOutTime) : "now"}`);
    router.refresh();
  };

  if (loadingPolicy) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasCheckedIn = !!localTodayRecord?.check_in_time;
  const hasCheckedOut = !!localTodayRecord?.check_out_time;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Secure Check-In / Check-Out
        </CardTitle>
        <CardDescription>
          {policy
            ? ATTENDANCE_MODE_LABELS[policy.mode]
            : "Record your workday"} — {format(new Date(), "MMMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {policy && !policy.selfCheckInEnabled && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Self check-in disabled</AlertTitle>
            <AlertDescription>
              Your organization uses admin-only attendance. Ask your manager to mark your attendance.
            </AlertDescription>
          </Alert>
        )}

        {policy && policy.selfCheckInEnabled && !policy.officeConfiguredForSecureMode && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Setup incomplete</AlertTitle>
            <AlertDescription>
              Office location is not configured yet. Contact your administrator before you can check in.
            </AlertDescription>
          </Alert>
        )}

        {policy && policy.requiresFaceMatch && !policy.faceEnrolled && (
          <Alert variant="destructive">
            <ScanFace className="h-4 w-4" />
            <AlertTitle>Face enrollment required</AlertTitle>
            <AlertDescription>
              Register your face in{" "}
              <Link href="/profile" className="font-medium underline">
                Profile
              </Link>{" "}
              before you can check in. This stops colleagues from checking in on your behalf.
            </AlertDescription>
          </Alert>
        )}

        {hasCheckedIn ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Checked in at {formatTime(localTodayRecord!.check_in_time!)}</span>
            </div>
            {localTodayRecord?.verification_flag && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This check-in was flagged for manager review.
                </AlertDescription>
              </Alert>
            )}
            {hasCheckedOut ? (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Checked out at {formatTime(localTodayRecord!.check_out_time!)}</span>
              </div>
            ) : (
              <Button
                onClick={handleCheckOut}
                disabled={isCheckingOut}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isCheckingOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4 rotate-180" />
                )}
                Check Out Now
              </Button>
            )}
          </div>
        ) : (
          policy?.selfCheckInEnabled && (
            <div className="space-y-4">
              {policy.requiresVideo && (
                <VideoVerificationCapture
                  label="OPay-style video verification"
                  hint="Record a 3-second clip and move your head slowly. Static photos are rejected."
                  disabled={isCheckingIn}
                  onVerified={(result) => setVerification(result)}
                />
              )}

              {verification?.previewUrl && (
                <video
                  src={verification.previewUrl}
                  controls
                  className="h-32 w-full max-w-sm rounded-lg border"
                />
              )}

              {policy.requiresQr && (
                <div className="space-y-4">
                  <QrCheckInScanner
                    onScan={(token) => setQrToken(token)}
                    disabled={isCheckingIn}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="desk-code">Or enter desk code manually</Label>
                    <Input
                      id="desk-code"
                      value={qrToken}
                      onChange={(e) => setQrToken(e.target.value.toUpperCase())}
                      placeholder="6-character code"
                      maxLength={6}
                      className="font-mono uppercase tracking-widest"
                    />
                  </div>
                </div>
              )}

              {(policy.mode === "standard" || policy.mode === "strict") && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  You must be within {policy.geofenceRadiusM}m of the office. Location access will be requested.
                </p>
              )}

              {locationStatus && (
                <p className="text-xs text-muted-foreground">{locationStatus}</p>
              )}

              <Button
                onClick={handleCheckIn}
                disabled={
                  isCheckingIn ||
                  !policy.officeConfiguredForSecureMode ||
                  (policy.requiresFaceMatch && !policy.faceEnrolled) ||
                  (policy.requiresVideo && !verification) ||
                  (policy.requiresQr && !qrToken.trim())
                }
                size="lg"
                className="w-full sm:w-auto"
              >
                {isCheckingIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Check In Now
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
