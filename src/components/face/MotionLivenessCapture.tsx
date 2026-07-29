"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  captureJpegFromVideo,
  grayscaleFrameDiff,
  sampleVideoGrayscale,
} from "@/lib/face/pixel-motion";
import { validatePixelMotionSamples, MIN_PIXEL_MOTION_FRAMES } from "@/lib/face/liveness";

export type MotionLivenessResult = {
  blob: Blob;
  motionScore: number;
  frameJpegs: Blob[];
};

const RECORD_MS = 3500;
const SAMPLE_MS = 400;

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(() => resolve());
    }
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    setTimeout(resolve, 150);
  });
}

/** Instant live motion check — canvas pixel diffs only, no ML model download. */
export function MotionLivenessCapture({
  onVerified,
  disabled,
  hint = "Center your face, then record for 3–4 seconds while slowly turning your head left and right.",
}: {
  onVerified: (result: MotionLivenessResult) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef(false);

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

  const startRecording = () => {
    const video = videoRef.current;
    if (!video || disabled || recordingRef.current || recording || processing) return;

    recordingRef.current = true;
    setRecording(true);
    setError(null);
    setProgress("Recording… 0% — move your head slowly");

    const frameDiffs: number[] = [];
    const pendingJpegs: Promise<Blob>[] = [];
    let previousGray: Uint8Array | null = null;
    const startedAt = Date.now();
    let sampleTimer: ReturnType<typeof setInterval> | null = null;
    let finished = false;

    const finish = async () => {
      if (finished) return;
      finished = true;
      if (sampleTimer) clearInterval(sampleTimer);
      recordingRef.current = false;
      setRecording(false);
      setProcessing(true);
      setProgress("Checking motion…");

      try {
        const captured = await Promise.all(pendingJpegs);
        const frameJpegs = captured.filter((jpeg) => jpeg.size > 200);
        const liveness = validatePixelMotionSamples(frameDiffs);
        if (!liveness.passed) {
          throw new Error(
            liveness.reason || "Live video required — static photos are not accepted."
          );
        }
        if (frameJpegs.length < MIN_PIXEL_MOTION_FRAMES) {
          throw new Error(
            "Not enough live frames captured — keep your face in view and move your head slowly."
          );
        }

        const blob = await captureJpegFromVideo(video);
        stopCamera();
        setProcessing(false);
        setProgress("");
        onVerified({ blob, motionScore: liveness.motionScore, frameJpegs });
      } catch (err) {
        setProcessing(false);
        setProgress("");
        setError(err instanceof Error ? err.message : "Liveness check failed");
        void startCamera();
      }
    };

    sampleTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= RECORD_MS) {
        void finish();
        return;
      }

      const current = sampleVideoGrayscale(video);
      if (current && previousGray) {
        frameDiffs.push(grayscaleFrameDiff(previousGray, current));
      }
      if (current) previousGray = current;

      pendingJpegs.push(captureJpegFromVideo(video, 240));

      const pct = Math.min(100, Math.round((elapsed / RECORD_MS) * 100));
      setProgress(`Recording… ${pct}% — move your head slowly`);
    }, SAMPLE_MS);
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          playsInline
          muted
          autoPlay
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
        onClick={startRecording}
        disabled={disabled || !cameraReady || starting || recording || processing}
      >
        <Video className="mr-2 h-4 w-4" />
        {recording ? "Recording…" : processing ? "Checking…" : "Record live check (4s)"}
      </Button>
    </div>
  );
}

export { MIN_MOTION_SCORE } from "@/lib/face/liveness";
