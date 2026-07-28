"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AwsFaceLivenessCapture } from "@/components/face/AwsFaceLivenessCapture";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";

export type AwsPhoneClockPayload = {
  photoBytes?: Blob;
  motionScore?: number;
  livenessSessionId?: string;
};

export function AwsPhoneClockCapture({
  token,
  awsLiveness,
  disabled,
  onSubmit,
}: {
  token: string;
  awsLiveness: boolean;
  disabled?: boolean;
  onSubmit: (payload: AwsPhoneClockPayload) => Promise<void>;
}) {
  const [mode, setMode] = useState<"loading" | "aws-liveness" | "motion">("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    const res = await fetch(`/api/clock/${token}/liveness/session`, { method: "POST" });
    const data = (await res.json()) as { sessionId?: string; error?: string };
    if (!res.ok || !data.sessionId) {
      throw new Error(data.error || "Could not start AWS Face Liveness");
    }
    setSessionId(data.sessionId);
    setMode("aws-liveness");
  }, [token]);

  useEffect(() => {
    void (async () => {
      try {
        if (awsLiveness) await startSession();
        else setMode("motion");
      } catch {
        setMode("motion");
      }
    })();
  }, [awsLiveness, startSession]);

  if (mode === "loading") {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === "aws-liveness" && sessionId ? (
        <AwsFaceLivenessCapture
          sessionId={sessionId}
          onComplete={(id) => void onSubmit({ livenessSessionId: id })}
          onError={(message) => {
            setError(message);
            setMode("motion");
            setSessionId(null);
          }}
        />
      ) : (
        <>
          <p className="text-muted-foreground text-center text-sm">
            Record a short live clip. Static photos and phone screens are rejected.
          </p>
          <MotionLivenessCapture
            disabled={disabled}
            onVerified={(result) => void onSubmit({ photoBytes: result.blob, motionScore: result.motionScore })}
          />
        </>
      )}
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </div>
  );
}
