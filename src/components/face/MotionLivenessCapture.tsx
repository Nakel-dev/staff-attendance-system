"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  captureLivenessLandmarkFrame,
  freezeVideoFrame,
  loadRegistrationDetector,
} from "@/lib/face/client";
import { validateLivenessLandmarkFrames } from "@/lib/face/liveness";

export type MotionLivenessResult = {
  blob: Blob;
  motionScore: number;
};

const RECORD_MS = 3000;
const SAMPLE_MS = 380;

function yieldToBrowser(ms = 16): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    video.requestVideoFrameCallback?.(() => resolve());
    setTimeout(resolve, 120);
  });
}

/** Fast live clip check using tiny face detector only — no heavy models or webm replay. */
export function MotionLivenessCapture({
  onVerified,
  disabled,
  hint = "Center your face, then record for 3 seconds while slowly turning your head left and right.",
}: {
  onVerified: (result: MotionLivenessResult) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelsReadyRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [starting, setStarting] = useState(true);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    setStarting(true);
    setError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraReady(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await waitForVideoFrame(videoRef.current);
      }
    } catch {
      setError("Could not access camera. Allow camera permission and try again.");
    } finally {
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (!cameraReady || modelsReadyRef.current) return;
    void loadRegistrationDetector()
      .then(() => {
        modelsReadyRef.current = true;
      })
      .catch(() => undefined);
  }, [cameraReady]);

  const startRecording = async () => {
    const video = videoRef.current;
    if (!video || disabled || recording || processing) return;

    setRecording(true);
    setError(null);
    setProgress("Preparing live check…");

    try {
      await loadRegistrationDetector();
      modelsReadyRef.current = true;
    } catch {
      setRecording(false);
      setProgress("");
      setError("Could not load face detection. Check your connection and try again.");
      return;
    }

    const landmarkFrames: number[][] = [];
    const startedAt = Date.now();

    while (Date.now() - startedAt < RECORD_MS) {
      if (!videoRef.current) break;
      await waitForVideoFrame(videoRef.current);
      const frame = await captureLivenessLandmarkFrame(videoRef.current);
      if (frame) landmarkFrames.push(frame);

      const pct = Math.min(100, Math.round(((Date.now() - startedAt) / RECORD_MS) * 100));
      setProgress(`Recording… ${pct}% — move your head slowly`);

      await yieldToBrowser(8);
      const elapsed = Date.now() - startedAt;
      const waitMs = SAMPLE_MS - (elapsed % SAMPLE_MS);
      if (waitMs > 0 && elapsed + waitMs < RECORD_MS) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    setRecording(false);
    setProcessing(true);
    setProgress("Checking motion…");
    await yieldToBrowser(16);

    try {
      const liveness = validateLivenessLandmarkFrames(landmarkFrames);
      if (!liveness.passed) {
        throw new Error(liveness.reason || "Live video required — static photos are not accepted.");
      }

      const canvas = freezeVideoFrame(video, 720);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88)
      );
      if (!blob) throw new Error("Could not capture photo");

      stopCamera();
      setProcessing(false);
      setProgress("");
      onVerified({ blob, motionScore: liveness.motionScore });
    } catch (err) {
      setProcessing(false);
      setProgress("");
      setError(err instanceof Error ? err.message : "Liveness check failed");
      void startCamera();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          playsInline
          muted
        />
        {(starting || recording || processing) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-4 text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">{progress || "Starting camera…"}</p>
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-center text-sm">{hint}</p>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}

      <Button
        className="w-full"
        size="lg"
        onClick={() => void startRecording()}
        disabled={disabled || !cameraReady || starting || recording || processing}
      >
        <Video className="mr-2 h-4 w-4" />
        {recording ? "Recording…" : processing ? "Checking…" : "Record live check (3s)"}
      </Button>
    </div>
  );
}

export { MIN_MOTION_SCORE } from "@/lib/face/liveness";
