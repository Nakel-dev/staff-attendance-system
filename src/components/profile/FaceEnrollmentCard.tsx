"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, Loader2, ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearFaceEnrollment, getFaceEnrollmentStatus } from "@/lib/actions/face";
import { createClient } from "@/lib/supabase/client";
import {
  FaceRegistrationCapture,
  type FaceRegistrationCaptureResult,
} from "@/components/face/FaceRegistrationCapture";
import type { BiometricProvider } from "@/lib/biometrics/providers";

type VerifyPhase = "idle" | "waiting" | "done";

export function FaceEnrollmentCard({ promptEnrollment = false }: { promptEnrollment?: boolean }) {
  const [provider, setProvider] = useState<BiometricProvider>("aws");
  const [providerReady, setProviderReady] = useState(true);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [phase, setPhase] = useState<VerifyPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const [status, configRes] = await Promise.all([
      getFaceEnrollmentStatus(),
      fetch("/api/staff/biometric/config").then((r) => r.json().catch(() => ({}))),
    ]);

    if (configRes.provider === "didit" || configRes.provider === "aws" || configRes.provider === "local") {
      setProvider(configRes.provider);
    }
    setProviderReady(configRes.ready !== false);
    setSetupHint(typeof configRes.setupHint === "string" ? configRes.setupHint : null);

    if ("error" in status) {
      setLoadError(status.error || "Failed to load verification status");
      return;
    }

    setLoadError(null);
    setEnrolled(status.enrolled);
    setEnrolledAt(status.enrolledAt);
    setHasPhoto(Boolean(status.hasProfilePhoto));
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshStatus();
      setLoading(false);
    })();
  }, [refreshStatus]);

  useEffect(() => {
    if (promptEnrollment && !loading && !enrolled && hasPhoto && providerReady) {
      if (provider === "didit") {
        document.getElementById("face-enrollment")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (provider === "aws" || provider === "local") {
        setShowCapture(true);
      }
    }
  }, [promptEnrollment, loading, enrolled, hasPhoto, provider, providerReady]);

  useEffect(() => {
    if (promptEnrollment && !loading && !hasPhoto) {
      document.getElementById("profile-photo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [promptEnrollment, loading, hasPhoto]);

  const pollDidit = useCallback(async (id: string) => {
    setPhase("waiting");
    setStatusText("Waiting for Didit face verification…");

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/staff/didit/status?sessionId=${id}`);
        const data = (await res.json()) as {
          error?: string;
          status?: string;
          terminal?: boolean;
          approved?: boolean;
          enrolled?: boolean;
          enrolledAt?: string | null;
        };
        if (!res.ok) {
          setStatusText(data.error || "Could not check verification status");
          continue;
        }
        setStatusText(`Didit status: ${data.status || "…"}`);
        if (data.terminal) {
          if (data.approved && data.enrolled) {
            setEnrolled(true);
            setEnrolledAt(data.enrolledAt || new Date().toISOString());
            setPhase("done");
            setSessionId(null);
            toast.success("Identity verified with Didit");
            if (promptEnrollment) {
              window.location.href = "/my-attendance";
            }
            return;
          }
          setPhase("idle");
          setSessionId(null);
          toast.error(
            data.status === "Declined"
              ? "Didit declined verification. Retake with good lighting."
              : `Verification ended: ${data.status}`
          );
          return;
        }
      } catch {
        setStatusText("Network error while checking Didit status");
      }
    }
    setPhase("idle");
    toast.error("Verification timed out. Complete the Didit window, then try again.");
  }, [promptEnrollment]);

  const startDiditVerify = async () => {
    if (!hasPhoto) {
      toast.error("Upload a profile photo first.");
      return;
    }
    setProcessing(true);
    setStatusText("");
    try {
      const res = await fetch("/api/staff/didit/start", { method: "POST" });
      const data = (await res.json()) as { error?: string; sessionId?: string; sessionUrl?: string };
      if (!res.ok || !data.sessionId || !data.sessionUrl) {
        throw new Error(data.error || "Could not start Didit verification");
      }
      setSessionId(data.sessionId);
      const popup = window.open(data.sessionUrl, "didit_identity", "width=480,height=720");
      if (!popup) toast.message("Popup blocked — allow popups for Didit.");
      void pollDidit(data.sessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start verification");
      setPhase("idle");
    } finally {
      setProcessing(false);
    }
  };

  const handleLocalOrAwsComplete = async (capture: FaceRegistrationCaptureResult) => {
    setProcessing(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      let referenceClipUrl: string | undefined;
      if (capture.referenceClipBlob) {
        const path = `${user.id}/registration-${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("face-reference-clips")
          .upload(path, capture.referenceClipBlob, {
            contentType: capture.referenceClipBlob.type || "video/webm",
            upsert: true,
          });
        if (uploadError) throw new Error(uploadError.message);
        referenceClipUrl = path;
      }

      if (provider === "aws") {
        if (!capture.snapshotJpeg) {
          throw new Error("Could not capture a live face frame for AWS matching.");
        }
        const form = new FormData();
        form.append("file", capture.snapshotJpeg, "live.jpg");
        const res = await fetch("/api/staff/aws/verify", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AWS verification failed");
        setEnrolled(true);
        setEnrolledAt(data.enrolledAt || new Date().toISOString());
        setShowCapture(false);
        toast.success(`AWS face match passed (${Number(data.similarity || 0).toFixed(0)}% similar)`);
        if (promptEnrollment) window.location.href = "/my-attendance";
        return;
      }

      const res = await fetch("/api/staff/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeddings: capture.angles.map((angle) => ({
            angle: angle.angle,
            descriptor: angle.descriptor,
            referenceClipUrl,
          })),
          referenceClipUrl,
          motionScore: capture.motionScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setEnrolled(true);
      setEnrolledAt(new Date().toISOString());
      setShowCapture(false);
      toast.success("Face registered. You can clock in at the reception kiosk.");
      if (promptEnrollment) window.location.href = "/my-attendance";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face registration failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = async () => {
    setProcessing(true);
    const result = await clearFaceEnrollment();
    setProcessing(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setEnrolled(false);
    setEnrolledAt(null);
    setShowCapture(false);
    setPhase("idle");
    setSessionId(null);
    toast.success("Identity verification cleared");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const title =
    provider === "didit"
      ? "Didit identity verification"
      : provider === "aws"
        ? "AWS face verification"
        : "Local face registration";

  const description =
    provider === "didit"
      ? "Required at signup: verify your live face matches your camera photo. Daily clock-in matches this enrollment."
      : provider === "aws"
        ? "Required at signup: guided liveness, then AWS matches your live face to your camera photo."
        : "Required at signup: register face angles here. Daily clock-in matches this enrollment at the kiosk.";

  return (
    <Card
      id="face-enrollment"
      className={
        promptEnrollment && !enrolled ? "border-primary ring-1 ring-primary/30" : undefined
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load status</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {setupHint && (
          <Alert variant="destructive">
            <AlertTitle>AWS not connected yet</AlertTitle>
            <AlertDescription>{setupHint}</AlertDescription>
          </Alert>
        )}

        {!hasPhoto && (
          <Alert>
            <AlertTitle>Profile photo required</AlertTitle>
            <AlertDescription>
              Capture a clear face photo with the camera above first, then continue AWS face verification here.
            </AlertDescription>
          </Alert>
        )}

        {enrolled ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Identity verified</AlertTitle>
            <AlertDescription>
              {enrolledAt
                ? `Verified on ${format(new Date(enrolledAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Your identity is verified for kiosk matching."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Verification needed</AlertTitle>
            <AlertDescription>
              Complete verification here so the reception kiosk can recognize you.
            </AlertDescription>
          </Alert>
        )}

        {statusText && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {phase === "waiting" && <Loader2 className="h-4 w-4 animate-spin" />}
            {statusText}
          </p>
        )}

        {provider === "didit" ? (
          <div className="flex flex-wrap gap-2">
            {!enrolled && (
              <Button
                onClick={() => void startDiditVerify()}
                disabled={processing || phase === "waiting" || !hasPhoto}
              >
                {processing || phase === "waiting" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Verify with Didit
              </Button>
            )}
            {enrolled && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void startDiditVerify()}
                  disabled={processing || phase === "waiting" || !hasPhoto}
                >
                  Re-verify with Didit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleClear()}
                  disabled={processing || phase === "waiting"}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear verification
                </Button>
              </>
            )}
            {sessionId && phase === "waiting" && (
              <Button variant="ghost" size="sm" onClick={() => void pollDidit(sessionId)}>
                Check status again
              </Button>
            )}
          </div>
        ) : (
          <>
            {!enrolled && !showCapture && (
              <Button
                onClick={() => setShowCapture(true)}
                disabled={processing || !hasPhoto || !providerReady}
              >
                {provider === "aws" ? "Start AWS face verification" : "Start face registration"}
              </Button>
            )}

            {providerReady && (showCapture || (enrolled && showCapture)) && (
              <FaceRegistrationCapture
                disabled={processing}
                onComplete={(result) => void handleLocalOrAwsComplete(result)}
              />
            )}

            {enrolled && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCapture(true)}
                  disabled={processing}
                >
                  Re-verify
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleClear()}
                  disabled={processing}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear verification
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
