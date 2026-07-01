"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureRegistrationAngle } from "@/lib/face/client";
import { validateLivenessFrames } from "@/lib/face/liveness";
import {
  FACE_ANGLE_PROMPTS,
  shuffleAngles,
  type FaceAngle,
} from "@/lib/kiosk/constants";

export interface AngleCaptureResult {
  angle: FaceAngle;
  descriptor: number[];
}

export interface FaceRegistrationCaptureResult {
  angles: AngleCaptureResult[];
  frameDescriptors: number[][];
  motionScore: number;
  referenceClipBlob?: Blob;
}

interface FaceRegistrationCaptureProps {
  onComplete: (result: FaceRegistrationCaptureResult) => void;
  disabled?: boolean;
}

export function FaceRegistrationCapture({ onComplete, disabled }: FaceRegistrationCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sequence] = useState(() => shuffleAngles());
  const [stepIndex, setStepIndex] = useState(0);
  const [captured, setCaptured] = useState<AngleCaptureResult[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const currentAngle = sequence[stepIndex];

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setError(null);
    setHint(null);
    setLoading(true);
    setCaptured([]);
    setStepIndex(0);

    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error("Camera requires HTTPS or localhost.");
      }
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 24 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera failed");
      stopCamera();
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || capturing || !cameraReady) return;

    setCapturing(true);
    setError(null);
    setHint(null);

    try {
      const result = await captureRegistrationAngle(video, currentAngle);

      if (!result.ok) {
        setHint(result.reason);
        return;
      }

      const entry = { angle: result.angle, descriptor: result.descriptor };
      const nextCaptured = [...captured, entry];
      setCaptured(nextCaptured);

      if (nextCaptured.length >= sequence.length) {
        const frameDescriptors = nextCaptured.map((item) => item.descriptor);
        const liveness = validateLivenessFrames(frameDescriptors, {
          minFrames: 5,
          minMotionScore: 0.015,
        });

        if (!liveness.passed) {
          setError(liveness.reason || "Please capture all angles again with slight head movement.");
          setCaptured([]);
          setStepIndex(0);
          return;
        }

        stopCamera();
        setTimeout(() => {
          onComplete({
            angles: nextCaptured,
            frameDescriptors,
            motionScore: liveness.motionScore,
          });
        }, 0);
        return;
      }

      setStepIndex((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Position your face for each prompt, then tap <strong>Capture this angle</strong>. The camera
        preview stays live — face analysis only runs when you tap capture (avoids browser freezes).
      </p>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-md">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full rounded-2xl bg-black object-cover ${cameraReady ? "block" : "hidden"}`}
          playsInline
          muted
          autoPlay
        />
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border bg-muted">
            <ScanFace className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        {capturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/75 text-white">
            <Loader2 className="mb-2 h-8 w-8 animate-spin" />
            <p className="text-sm px-4 text-center">Analyzing this angle…</p>
            <p className="text-xs px-4 text-center mt-1 text-white/80">This may take a few seconds</p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-full border-4 border-primary/80" />
        </div>
        {cameraReady && !capturing && (
          <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 p-3 text-center text-sm text-white">
            {FACE_ANGLE_PROMPTS[currentAngle]}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {sequence.map((angle, index) => {
          const done = captured.some((c) => c.angle === angle);
          const active = index === stepIndex && cameraReady && !capturing;
          return (
            <span
              key={angle}
              className={`rounded-full px-3 py-1 text-xs ${
                done
                  ? "bg-green-500/15 text-green-700"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
              {angle}
            </span>
          );
        })}
      </div>

      {!cameraReady && (
        <Button type="button" onClick={startCamera} disabled={disabled || loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {loading ? "Opening camera…" : "Enable camera"}
        </Button>
      )}

      {cameraReady && (
        <>
          <Button
            type="button"
            className="w-full"
            disabled={disabled || capturing}
            onClick={() => void handleCapture()}
          >
            {capturing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <ScanFace className="mr-2 h-4 w-4" />
                Capture this angle ({stepIndex + 1}/{sequence.length})
              </>
            )}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={capturing} onClick={stopCamera}>
            Stop camera
          </Button>
        </>
      )}

      {hint && <p className="text-sm text-amber-600 dark:text-amber-400">{hint}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
