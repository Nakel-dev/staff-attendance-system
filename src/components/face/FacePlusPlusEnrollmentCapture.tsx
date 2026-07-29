"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { appendMotionFrames } from "@/lib/face/motion-upload";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

/** Portal enrollment: motion clip + Face++ match against profile photo. */
export function FacePlusPlusEnrollmentCapture({
  onSuccess,
  onStop,
  disabled,
}: {
  onSuccess: (result: { enrolledAt: string; confidence: number }) => void;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const completeVerification = async (result: {
    blob: Blob;
    motionScore: number;
    frameJpegs: Blob[];
  }) => {
    setBusy(true);
    setStatus("Verifying with Face++…");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", result.blob, "live.jpg");
      appendMotionFrames(form, result.frameJpegs);
      const res = await fetchWithTimeout("/api/staff/facepp/verify", {
        method: "POST",
        body: form,
        timeoutMs: 45000,
      });
      const data = (await res.json()) as {
        error?: string;
        enrolledAt?: string;
        confidence?: number;
      };
      if (!res.ok) throw new Error(data.error || "Verification failed");
      onSuccess({
        enrolledAt: data.enrolledAt || new Date().toISOString(),
        confidence: data.confidence ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <div className="space-y-4">
      {!busy ? (
        <>
          <p className="text-muted-foreground text-center text-sm">
            Record a short live clip. Your face must match the profile photo above. The reception
            kiosk uses this same verification — you cannot clock in from this portal.
          </p>
          <MotionLivenessCapture
            disabled={disabled}
            onVerified={(result) => void completeVerification(result)}
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
