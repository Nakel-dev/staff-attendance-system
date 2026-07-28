"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, Loader2, ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearFaceEnrollment, getFaceEnrollmentStatus } from "@/lib/actions/face";

type VerifyPhase = "idle" | "waiting" | "done";

export function FaceEnrollmentCard({ promptEnrollment = false }: { promptEnrollment?: boolean }) {
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [diditConfigured, setDiditConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<VerifyPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const [status, configRes] = await Promise.all([
      getFaceEnrollmentStatus(),
      fetch("/api/staff/didit/config").then((r) => r.json().catch(() => ({ configured: false }))),
    ]);

    setDiditConfigured(Boolean(configRes.configured));

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

  const pollDidit = useCallback(
    async (id: string) => {
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
              return;
            }
            setPhase("idle");
            setSessionId(null);
            toast.error(
              data.status === "Declined"
                ? "Didit declined verification. Retake with good lighting and face the camera."
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
    },
    []
  );

  const startDiditVerify = async () => {
    if (!hasPhoto) {
      toast.error("Upload a profile photo first, then verify with Didit.");
      return;
    }
    if (!diditConfigured) {
      toast.error("Didit is not configured on this deployment.");
      return;
    }

    setProcessing(true);
    setStatusText("");
    try {
      const res = await fetch("/api/staff/didit/start", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        sessionId?: string;
        sessionUrl?: string;
      };
      if (!res.ok || !data.sessionId || !data.sessionUrl) {
        throw new Error(data.error || "Could not start Didit verification");
      }

      setSessionId(data.sessionId);
      const popup = window.open(data.sessionUrl, "didit_identity", "width=480,height=720");
      if (!popup) {
        toast.message("Popup blocked — open the Didit link from the button below.");
      }
      void pollDidit(data.sessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start verification");
      setPhase("idle");
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

  return (
    <Card
      className={
        promptEnrollment && !enrolled ? "border-primary ring-1 ring-primary/30" : undefined
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          Didit identity verification
        </CardTitle>
        <CardDescription>
          Verify you match your profile photo with Didit (liveness + face match). This is for
          identity setup only — clock in/out stays at the reception kiosk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load status</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!diditConfigured && (
          <Alert variant="destructive">
            <AlertTitle>Didit not configured</AlertTitle>
            <AlertDescription>
              Ask your admin to set DIDIT_API_KEY and DIDIT_WORKFLOW_ID (biometric authentication
              workflow).
            </AlertDescription>
          </Alert>
        )}

        {!hasPhoto && (
          <Alert>
            <AlertTitle>Profile photo required</AlertTitle>
            <AlertDescription>
              Upload a clear face photo above first. Didit compares your live selfie to that photo.
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
                : "Your identity is verified for kiosk face matching."}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Verification needed</AlertTitle>
            <AlertDescription>
              Complete Didit verification so the reception kiosk can match your face when you clock
              in.
            </AlertDescription>
          </Alert>
        )}

        {statusText && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {phase === "waiting" && <Loader2 className="h-4 w-4 animate-spin" />}
            {statusText}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!enrolled && (
            <Button
              onClick={() => void startDiditVerify()}
              disabled={processing || phase === "waiting" || !hasPhoto || !diditConfigured}
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
                disabled={processing || phase === "waiting" || !hasPhoto || !diditConfigured}
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
      </CardContent>
    </Card>
  );
}
