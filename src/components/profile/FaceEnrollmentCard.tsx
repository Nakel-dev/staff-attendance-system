"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, Loader2, ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearFaceEnrollment, getFaceEnrollmentStatus } from "@/lib/actions/face";
import { FacePlusPlusEnrollmentCapture } from "@/components/face/FacePlusPlusEnrollmentCapture";
import { LocalFaceEnrollmentCapture } from "@/components/face/LocalFaceEnrollmentCapture";

type PortalVerifyProvider = "faceplusplus" | "didit" | "local";

type VerifyPhase = "idle" | "waiting" | "done";

export function FaceEnrollmentCard({ promptEnrollment = false }: { promptEnrollment?: boolean }) {
  const [provider, setProvider] = useState<PortalVerifyProvider>("faceplusplus");
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

    if (
      configRes.portalProvider === "faceplusplus" ||
      configRes.portalProvider === "didit" ||
      configRes.portalProvider === "local"
    ) {
      setProvider(configRes.portalProvider);
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
      } else {
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

  const handleFacePlusPlusSuccess = (result: { enrolledAt: string; confidence: number }) => {
    setEnrolled(true);
    setEnrolledAt(result.enrolledAt);
    setShowCapture(false);
    setProcessing(false);
    toast.success(`Face verified (${result.confidence.toFixed(0)}% match). Clock in at the reception kiosk.`);
    if (promptEnrollment) window.location.href = "/my-attendance";
  };

  const handleLocalEnrollmentSuccess = (result: { enrolledAt: string }) => {
    setEnrolled(true);
    setEnrolledAt(result.enrolledAt);
    setShowCapture(false);
    setProcessing(false);
    toast.success("Face registered. You can clock in at the reception kiosk.");
    if (promptEnrollment) window.location.href = "/my-attendance";
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
    provider === "faceplusplus"
      ? "Face verification (portal)"
      : provider === "didit"
        ? "Didit identity verification"
        : "Local face registration";

  const description =
    provider === "faceplusplus"
      ? "Required once: verify your live face matches your profile photo. The reception kiosk matches against this verification — clock in/out is not available here."
      : provider === "didit"
        ? "Required once: verify your live face matches your profile photo. Kiosk clock-in uses the same identity."
        : "Required once: record a live clip here. Kiosk matching uses your profile photo above.";

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
            <AlertTitle>Verification not available</AlertTitle>
            <AlertDescription>{setupHint}</AlertDescription>
          </Alert>
        )}

        {!hasPhoto && (
          <Alert>
            <AlertTitle>Profile photo required</AlertTitle>
            <AlertDescription>
              Capture a clear face photo with the camera above first, then complete face verification here.
            </AlertDescription>
          </Alert>
        )}

        {enrolled ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Identity verified</AlertTitle>
            <AlertDescription>
              {enrolledAt
                ? `Verified on ${format(new Date(enrolledAt), "MMM d, yyyy 'at' h:mm a")}. Use the reception kiosk to clock in and out.`
                : "Your identity is verified for kiosk matching. Clock in/out only at reception."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Verification needed</AlertTitle>
            <AlertDescription>
              Complete verification here before using the kiosk. This portal is for identity setup and
              viewing records only — not for clocking in or out.
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
                {provider === "faceplusplus" ? "Start face verification" : "Start face registration"}
              </Button>
            )}

            {providerReady && showCapture && provider === "faceplusplus" && (
              <FacePlusPlusEnrollmentCapture
                disabled={processing}
                onStop={() => setShowCapture(false)}
                onSuccess={handleFacePlusPlusSuccess}
              />
            )}

            {providerReady && showCapture && provider === "local" && (
              <LocalFaceEnrollmentCapture
                disabled={processing}
                onStop={() => setShowCapture(false)}
                onSuccess={handleLocalEnrollmentSuccess}
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
