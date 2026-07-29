"use client";

import { useState } from "react";
import { Loader2, ScanFace, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AwsFaceLivenessCapture } from "@/components/face/AwsFaceLivenessCapture";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

export type AwsPhoneClockPayload = {
  photoBytes?: Blob;
  motionScore?: number;
  livenessSessionId?: string;
  frameJpegs?: Blob[];
};

type Phase = "choose" | "aws-liveness" | "motion";

/** AWS phone clock: Cognito Face Liveness when configured, else motion + server re-check + CompareFaces. */
export function AwsPhoneClockCapture({
  token,
  awsLivenessEnabled,
  disabled,
  onSubmit,
}: {
  token: string;
  awsLivenessEnabled?: boolean;
  disabled?: boolean;
  onSubmit: (payload: AwsPhoneClockPayload) => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>(awsLivenessEnabled ? "choose" : "motion");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAwsLiveness = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/clock/${token}/liveness/session`, {
        method: "POST",
        timeoutMs: 30000,
      });
      const data = (await res.json()) as { error?: string; sessionId?: string };
      if (!res.ok || !data.sessionId) {
        throw new Error(data.error || "Could not start AWS Face Liveness");
      }
      setSessionId(data.sessionId);
      setPhase("aws-liveness");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start AWS Face Liveness");
    } finally {
      setStarting(false);
    }
  };

  if (phase === "aws-liveness" && sessionId) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-center text-sm">
          Follow the AWS prompts to prove you are live, then we match your face.
        </p>
        <AwsFaceLivenessCapture
          sessionId={sessionId}
          onComplete={(sid) => void onSubmit({ livenessSessionId: sid })}
          onError={(message) => {
            setError(message);
            setPhase("choose");
            setSessionId(null);
          }}
        />
        {error && <p className="text-destructive text-center text-sm">{error}</p>}
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPhase("choose")}>
          Back
        </Button>
      </div>
    );
  }

  if (phase === "motion") {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-center text-sm">
          Record a short live clip. Static photos are rejected on the server, then AWS matches your
          face.
        </p>
        <MotionLivenessCapture
          disabled={disabled}
          onVerified={(result) => {
            void onSubmit({
              photoBytes: result.blob,
              motionScore: result.motionScore,
              frameJpegs: result.frameJpegs,
            });
          }}
        />
        {error && <p className="text-destructive text-center text-sm">{error}</p>}
        {awsLivenessEnabled && (
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPhase("choose")}>
            Back to AWS Face Liveness
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">
        AWS Face Liveness is available. Use it for the strongest protection against photo spoofing.
      </p>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <Button className="w-full" size="lg" onClick={() => void startAwsLiveness()} disabled={disabled || starting}>
        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
        Start AWS Face Liveness
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setPhase("motion")}
        disabled={disabled || starting}
      >
        <Video className="mr-2 h-4 w-4" />
        Use motion check instead
      </Button>
    </div>
  );
}
