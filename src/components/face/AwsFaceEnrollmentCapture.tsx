"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

export type AwsFaceEnrollmentResult = {
  enrolledAt: string;
  similarity: number;
  livenessScore: number;
};

/** AWS enrollment: motion liveness + CompareFaces (no ML model load on this screen). */
export function AwsFaceEnrollmentCapture({
  onSuccess,
  onStop,
  disabled,
}: {
  onSuccess: (result: AwsFaceEnrollmentResult) => void;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {!busy ? (
        <>
          <p className="text-muted-foreground text-center text-sm">
            Record a short live clip. Static photos and phone screens are rejected, then AWS
            compares your face to your profile photo.
          </p>
          <MotionLivenessCapture
            disabled={disabled}
            onVerified={(result) => void verifyWithMotion(result.blob, result.motionScore)}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8">
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
