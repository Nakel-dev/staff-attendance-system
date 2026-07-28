"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ScanFace, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KioskPhotoCapture } from "@/components/kiosk/KioskPhotoCapture";

type Provider = "local" | "aws" | "didit";

type ChallengeInfo = {
  status: string;
  attemptType: "check_in" | "check_out";
  expiresAt: string;
  secondsLeft: number;
  staffName: string;
  hasAvatar: boolean;
  faceEnrolled: boolean;
  organizationName: string;
  kioskName: string;
  provider: Provider;
};

const DIDIT_KEY = (token: string) => `phone_clock_didit:${token}`;

export function PhoneClockClient({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clock/${token}`);
      const data = (await res.json()) as {
        error?: string;
        challenge?: ChallengeInfo;
      };
      if (!res.ok || !data.challenge) {
        setError(data.error || "Invalid QR code");
        setChallenge(null);
        return;
      }
      setChallenge(data.challenge);
      setSecondsLeft(data.challenge.secondsLeft);
      setError(null);
      if (data.challenge.status === "completed") {
        setDoneMessage("Already completed. You can put your phone away.");
      } else if (data.challenge.status !== "pending") {
        setError(`This QR is ${data.challenge.status}. Ask reception for a new code.`);
      }
    } catch {
      setError("Could not load this QR link");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!challenge || challenge.status !== "pending") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [challenge]);

  const completeWithDidit = useCallback(
    async (sessionId: string) => {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/clock/${token}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diditSessionId: sessionId }),
        });
        const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
        if (data.success) {
          setDoneMessage(data.message || "Clocked successfully");
          toast.success(data.message || "Done");
          try {
            sessionStorage.removeItem(DIDIT_KEY(token));
          } catch {
            /* ignore */
          }
        } else {
          toast.error(data.message || data.error || "Verification failed");
          setError(data.message || data.error || "Verification failed");
        }
      } catch {
        toast.error("Network error finishing clock");
      } finally {
        setSubmitting(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (searchParams.get("didit_done") !== "1" || doneMessage) return;
    let sessionId: string | null = null;
    try {
      sessionId = sessionStorage.getItem(DIDIT_KEY(token));
    } catch {
      sessionId = null;
    }
    if (!sessionId) {
      setError("Didit finished, but session was lost. Ask reception for a new QR.");
      return;
    }
    void completeWithDidit(sessionId);
  }, [completeWithDidit, doneMessage, searchParams, token]);

  const startDidit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clock/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_didit" }),
      });
      const data = (await res.json()) as {
        sessionId?: string;
        sessionUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionId || !data.sessionUrl) {
        toast.error(data.error || "Could not start face check");
        return;
      }
      try {
        sessionStorage.setItem(DIDIT_KEY(token), data.sessionId);
      } catch {
        /* ignore */
      }
      window.location.href = data.sessionUrl;
    } catch {
      toast.error("Could not start face check");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPhoto = async (blob: Blob) => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", blob, "selfie.jpg");
      const res = await fetch(`/api/clock/${token}/complete`, { method: "POST", body: form });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (data.success) {
        setDoneMessage(data.message || "Clocked successfully");
        toast.success(data.message || "Done");
      } else {
        toast.error(data.message || data.error || "Could not clock");
        setError(data.message || data.error || "Could not clock");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (doneMessage) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-3 py-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <p className="text-lg font-medium">{doneMessage}</p>
          <p className="text-muted-foreground text-sm">You can close this page.</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !challenge) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-3 py-10 text-center">
          <p className="text-destructive">{error}</p>
          <p className="text-muted-foreground text-sm">Scan a new QR at the reception kiosk.</p>
        </CardContent>
      </Card>
    );
  }

  if (!challenge) return null;

  const expired = secondsLeft <= 0 || challenge.status === "expired";
  const actionLabel = challenge.attemptType === "check_in" ? "Check in" : "Check out";

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-center">{actionLabel}</CardTitle>
        <p className="text-center text-muted-foreground text-sm">
          {challenge.staffName} · {challenge.organizationName}
        </p>
        <p className="text-center text-muted-foreground text-xs">{challenge.kioskName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Timer className="h-4 w-4" />
          {expired ? (
            <span className="text-destructive">QR expired — get a new code at the kiosk</span>
          ) : (
            <span>{secondsLeft}s left</span>
          )}
        </div>

        {error && <p className="text-center text-destructive text-sm">{error}</p>}

        {expired || challenge.status !== "pending" ? null : challenge.provider === "didit" ? (
          <div className="space-y-3 text-center">
            <ScanFace className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm">Finish face verification on this phone to {actionLabel.toLowerCase()}.</p>
            <Button className="w-full" size="lg" onClick={() => void startDidit()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start face check
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-center text-sm">
              Take a live selfie to finish {actionLabel.toLowerCase()}.
            </p>
            {submitting ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <KioskPhotoCapture onCapture={(blob) => void submitPhoto(blob)} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
