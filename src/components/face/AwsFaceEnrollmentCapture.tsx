"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AwsFaceLivenessCapture } from "@/components/face/AwsFaceLivenessCapture";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

export type AwsFaceEnrollmentResult = {
  enrolledAt: string;
  similarity: number;
  livenessScore: number;
};

type Mode = "loading" | "aws-liveness" | "motion";

/**
 * AWS enrollment: Face Liveness when Cognito is configured, otherwise motion liveness + CompareFaces.
 */
export function AwsFaceEnrollmentCapture({
  onSuccess,
  onStop,
  disabled,
}: {
  onSuccess: (result: AwsFaceEnrollmentResult) => void;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setError(null);
    setStatus("Starting AWS Face Liveness…");
    const res = await fetchWithTimeout("/api/staff/aws/liveness/session", {
      method: "POST",
      timeoutMs: 20000,
    });
    const data = (await res.json()) as { sessionId?: string; error?: string };
    if (!res.ok || !data.sessionId) {
      throw new Error(data.error || "Could not start AWS Face Liveness");
    }
    setSessionId(data.sessionId);
    setMode("aws-liveness");
    setStatus(null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const configRes = await fetch("/api/staff/biometric/config");
        const config = (await configRes.json()) as { awsLiveness?: boolean };
        if (config.awsLiveness) {
          await startSession();
        } else {
          setMode("motion");
        }
      } catch {
        setMode("motion");
      }
    })();
  }, [startSession]);

  const verifyWithSession = async (id: string) => {
    setBusy(true);
    setStatus("Matching face with AWS Rekognition…");
    setError(null);
    try {
      const form = new FormData();
      form.append("sessionId", id);
      const res = await fetchWithTimeout("/api/staff/aws/verify", {
        method: "POST",
        body: form,
        timeoutMs: 90000,
      });
      const data = (await res.json()) as {
        error?: string;
        enrolledAt?: string;
        similarity?: number;
        livenessScore?: number;
      };
      if (!res.ok) throw new Error(data.error || "AWS verification failed");
      onSuccess({
        enrolledAt: data.enrolledAt || new Date().toISOString(),
        similarity: Number(data.similarity || 0),
        livenessScore: Number(data.livenessScore || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AWS verification failed");
      setBusy(false);
      setStatus(null);
    }
  };

  const verifyWithMotion = async (blob: Blob, motionScore: number) => {
    setBusy(true);
    setStatus("Matching face with AWS Rekognition…");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", blob, "live.jpg");
      form.append("motionScore", String(motionScore));
      const res = await fetchWithTimeout("/api/staff/aws/verify", {
        method: "POST",
        body: form,
        timeoutMs: 90000,
      });
      const data = (await res.json()) as {
        error?: string;
        enrolledAt?: string;
        similarity?: number;
        livenessScore?: number;
      };
      if (!res.ok) throw new Error(data.error || "AWS verification failed");
      onSuccess({
        enrolledAt: data.enrolledAt || new Date().toISOString(),
        similarity: Number(data.similarity || 0),
        livenessScore: Number(data.livenessScore || motionScore),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AWS verification failed");
      setBusy(false);
      setStatus(null);
    }
  };

  if (mode === "loading") {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{status || "Preparing verification…"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "aws-liveness" && sessionId && !busy ? (
        <AwsFaceLivenessCapture
          sessionId={sessionId}
          onComplete={(id) => void verifyWithSession(id)}
          onError={(message) => {
            setError(message);
            setMode("motion");
            setSessionId(null);
          }}
        />
      ) : null}

      {mode === "motion" && !busy ? (
        <>
          <p className="text-muted-foreground text-center text-sm">
            Record a short live clip. Static photos and phone screens are rejected.
          </p>
          <MotionLivenessCapture
            disabled={disabled}
            onVerified={(result) => void verifyWithMotion(result.blob, result.motionScore)}
          />
        </>
      ) : null}

      {busy && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{status}</p>
        </div>
      )}

      {error && <p className="text-destructive text-center text-sm">{error}</p>}

      {onStop && (
        <Button type="button" variant="outline" onClick={onStop} disabled={busy}>
          Cancel
        </Button>
      )}
    </div>
  );
}
