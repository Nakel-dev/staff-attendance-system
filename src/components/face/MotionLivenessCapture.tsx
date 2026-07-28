"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFaceModels } from "@/lib/face/client";
import {
  MIN_LIVENESS_FRAMES,
  MIN_MOTION_SCORE,
  pickBestDescriptor,
  validateLivenessFrames,
} from "@/lib/face/liveness";

export type MotionLivenessResult = {
  blob: Blob;
  motionScore: number;
};

async function captureFrameDescriptor(
  video: HTMLVideoElement,
  faceapi: typeof import("@vladmandic/face-api")
) {
  const detection = await faceapi
    .detectSingleFace(video)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}

/** Short live video clip with head movement — rejects static photos. */
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraReady(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
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

  const finishRecording = async (videoBlob: Blob) => {
    const video = videoRef.current;
    if (!video) return;

    setProcessing(true);
    setProgress("Checking live motion…");
    try {
      await loadFaceModels();
      const faceapi = await import("@vladmandic/face-api");
      const frameDescriptors: number[][] = [];
      const tempVideo = document.createElement("video");
      tempVideo.src = URL.createObjectURL(videoBlob);
      tempVideo.muted = true;
      await tempVideo.play();

      const durationMs = Math.min(tempVideo.duration * 1000 || 3000, 4000);
      const intervalMs = Math.max(120, Math.floor(durationMs / MIN_LIVENESS_FRAMES));
      for (let t = 0; t < durationMs; t += intervalMs) {
        tempVideo.currentTime = t / 1000;
        await new Promise((r) => setTimeout(r, 80));
        const descriptor = await captureFrameDescriptor(tempVideo, faceapi);
        if (descriptor) frameDescriptors.push(descriptor);
      }
      URL.revokeObjectURL(tempVideo.src);

      const liveness = validateLivenessFrames(frameDescriptors);
      if (!liveness.passed) {
        throw new Error(liveness.reason || "Live video required — static photos are not accepted.");
      }

      pickBestDescriptor(frameDescriptors);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture photo");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("Could not capture photo");

      stopCamera();
      onVerified({ blob, motionScore: liveness.motionScore });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Liveness check failed");
      setProcessing(false);
      setProgress("");
      void startCamera();
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || disabled || recording || processing) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      void finishRecording(blob);
    };

    setRecording(true);
    setError(null);
    setProgress("Recording… move your head slowly");
    recorder.start();
    setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      setRecording(false);
    }, 3000);
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
        onClick={startRecording}
        disabled={disabled || !cameraReady || starting || recording || processing}
      >
        <Video className="mr-2 h-4 w-4" />
        {recording ? "Recording…" : processing ? "Checking…" : "Record live check (3s)"}
      </Button>
    </div>
  );
}

export { MIN_MOTION_SCORE };
