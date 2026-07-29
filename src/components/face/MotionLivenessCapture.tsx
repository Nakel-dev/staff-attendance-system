"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  captureJpegFromVideo,
  sampleVideoGrayscale,
} from "@/lib/face/pixel-motion";
import { validateGrayscaleMotionSequence } from "@/lib/face/motion-analysis";
import { MIN_PIXEL_MOTION_FRAMES } from "@/lib/face/liveness";

export type MotionLivenessResult = {
  blob: Blob;
  motionScore: number;
  frameJpegs: Blob[];
};

const RECORD_MS = 4000;
const SAMPLE_MS = 450;

type HeadTurnChallenge = "left" | "right";

function randomChallenge(): HeadTurnChallenge {
  return Math.random() < 0.5 ? "left" : "right";
}

function challengeHint(challenge: HeadTurnChallenge, phase: "start" | "mid" | "end"): string {
  const turn =
    challenge === "left"
      ? "Slowly turn your head to YOUR LEFT"
      : "Slowly turn your head to YOUR RIGHT";
  if (phase === "start") return `Look at the camera, then ${turn.toLowerCase()}.`;
  if (phase === "mid") return `${turn}, then turn back to center.`;
  return "Turn back to face the camera.";
}

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

/** Lightweight live motion check — head-turn challenge, no ML model download. */
export function MotionLivenessCapture({
  onVerified,
  disabled,
  hint,
}: {
  onVerified: (result: MotionLivenessResult) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef(false);
  const challengeRef = useRef<HeadTurnChallenge>(randomChallenge());

  const [cameraReady, setCameraReady] = useState(false);
  const [starting, setStarting] = useState(true);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const defaultHint = useMemo(
    () =>
      hint ||
      "Center your face, then record ~4 seconds while slowly turning your head left and right. Static photos are rejected.",
    [hint]
  );

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
        video: {
          facingMode: "user",
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 24 },
        },
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

    challengeRef.current = randomChallenge();
    recordingRef.current = true;
    setRecording(true);
    setError(null);
    setProgress(challengeHint(challengeRef.current, "start"));

    const grayFrames: Uint8Array[] = [];
    const pendingJpegs: Promise<Blob>[] = [];
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
      setProgress("Checking head movement…");

      try {
        const captured = await Promise.all(pendingJpegs);
        const frameJpegs = captured.filter((jpeg) => jpeg.size > 200);
        const liveness = validateGrayscaleMotionSequence(grayFrames);

        if (!liveness.passed) {
          throw new Error(
            liveness.reason || "Live video required — static photos are not accepted."
          );
        }
        if (frameJpegs.length < MIN_PIXEL_MOTION_FRAMES) {
          throw new Error(
            "Not enough live frames captured — keep your face in view and turn your head slowly."
          );
        }

        const blob = await captureJpegFromVideo(video, 480);
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
      if (current) grayFrames.push(current);

      pendingJpegs.push(captureJpegFromVideo(video, 200));

      const phase = elapsed < RECORD_MS * 0.35 ? "start" : elapsed < RECORD_MS * 0.7 ? "mid" : "end";
      const pct = Math.min(100, Math.round((elapsed / RECORD_MS) * 100));
      setProgress(`${challengeHint(challengeRef.current, phase)} (${pct}%)`);
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

      <p className="text-muted-foreground text-center text-sm">{defaultHint}</p>
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

      <p className="text-muted-foreground text-center text-xs">
        Lightweight check — works on 4 GB RAM PCs. Shaking a photo at the camera will not pass.
      </p>
    </div>
  );
}

export { MIN_MOTION_SCORE } from "@/lib/face/liveness";
