"use client";

import { useState } from "react";
import { Loader2, ScanFace, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AwsFaceLivenessCapture } from "@/components/face/AwsFaceLivenessCapture";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { appendMotionFrames } from "@/lib/face/motion-upload";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

export type AwsFaceEnrollmentResult = {
  enrolledAt: string;
  similarity: number;
  livenessScore: number;
};

type Phase = "choose" | "aws-liveness" | "motion";

/** AWS enrollment: Cognito Face Liveness when configured, else motion + server re-check + CompareFaces. */
export function AwsFaceEnrollmentCapture({
  awsLivenessEnabled,
  onSuccess,
  onStop,
  disabled,
}: {
  awsLivenessEnabled?: boolean;
  onSuccess: (result: AwsFaceEnrollmentResult) => void;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(awsLivenessEnabled ? "choose" : "motion");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const verifyWithSession = async (sid: string) => {
    setBusy(true);
    setStatus("Matching face with AWS Rekognition…");
    setError(null);
    try {
      const form = new FormData();
      form.append("sessionId", sid);
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
      setPhase("choose");
      setSessionId(null);
    }
  };

  const verifyWithMotion = async (result: {
    blob: Blob;
    motionScore: number;
    frameJpegs: Blob[];
  }) => {
    setBusy(true);
    setStatus("Matching face with AWS Rekognition…");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", result.blob, "live.jpg");
      appendMotionFrames(form, result.frameJpegs);
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
        livenessScore: Number(data.livenessScore || result.motionScore),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AWS verification failed");
      setBusy(false);
      setStatus(null);
    }
  };

  const startAwsLiveness = async () => {
    setBusy(true);
    setError(null);
    setStatus("Starting AWS Face Liveness…");
    try {
      const res = await fetchWithTimeout("/api/staff/aws/liveness/session", {
        method: "POST",
        timeoutMs: 30000,
      });
      const data = (await res.json()) as { error?: string; sessionId?: string };
      if (!res.ok || !data.sessionId) {
        throw new Error(data.error || "Could not start AWS Face Liveness");
      }
      setSessionId(data.sessionId);
      setPhase("aws-liveness");
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start AWS Face Liveness");
    } finally {
      setBusy(false);
    }
  };

  if (busy && phase !== "aws-liveness") {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{status}</p>
        {error && <p className="text-destructive text-center text-sm">{error}</p>}
      </div>
    );
  }

  if (phase === "aws-liveness" && sessionId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          Follow the on-screen prompts. AWS checks that you are a live person, then compares your
          face to your profile photo.
        </p>
        <AwsFaceLivenessCapture
          sessionId={sessionId}
          onComplete={(sid) => void verifyWithSession(sid)}
          onError={(message) => {
            setError(message);
            setPhase("choose");
            setSessionId(null);
          }}
        />
        {error && <p className="text-destructive text-center text-sm">{error}</p>}
        {onStop && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPhase("choose");
              setSessionId(null);
              onStop();
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    );
  }

  if (phase === "motion") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          Record a short live clip. Static photos are rejected on the server, then AWS compares
          your face to your profile photo.
        </p>
        <MotionLivenessCapture
          disabled={disabled || busy}
          onVerified={(result) => void verifyWithMotion(result)}
        />
        {error && <p className="text-destructive text-center text-sm">{error}</p>}
        {onStop && (
          <Button type="button" variant="outline" onClick={onStop} disabled={busy}>
            Cancel
          </Button>
        )}
        {awsLivenessEnabled && (
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPhase("choose")}>
            Back to AWS Face Liveness
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center text-sm">
        AWS Face Liveness is enabled for your organization. This is the strongest check against
        photos and screen replay.
      </p>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <Button className="w-full" size="lg" onClick={() => void startAwsLiveness()} disabled={disabled || busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
        Start AWS Face Liveness
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setPhase("motion")}
        disabled={disabled || busy}
      >
        <Video className="mr-2 h-4 w-4" />
        Use motion check instead
      </Button>
      {onStop && (
        <Button type="button" variant="ghost" onClick={onStop} disabled={busy}>
          Cancel
        </Button>
      )}
    </div>
  );
}
