"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { preloadRegistrationModels } from "@/lib/face/client";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

/** Local enrollment: fast motion check only (face template comes from profile photo). */
export function LocalFaceEnrollmentCapture({
  onSuccess,
  onStop,
  disabled,
}: {
  onSuccess: (result: { enrolledAt: string }) => void;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    preloadRegistrationModels();
  }, []);

  const completeEnrollment = async (motionScore: number) => {
    setBusy(true);
    setStatus("Saving enrollment…");
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/staff/register-face/motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motionScore }),
        timeoutMs: 30000,
      });
      const data = (await res.json()) as { error?: string; enrolledAt?: string };
      if (!res.ok) throw new Error(data.error || "Registration failed");
      onSuccess({ enrolledAt: data.enrolledAt || new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <div className="space-y-4">
      {!busy ? (
        <>
          <p className="text-muted-foreground text-center text-sm">
            Record a short live clip. Your reference photo above is used for kiosk matching — no
            heavy face scan here.
          </p>
          <MotionLivenessCapture
            disabled={disabled}
            onVerified={(result) => void completeEnrollment(result.motionScore)}
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
