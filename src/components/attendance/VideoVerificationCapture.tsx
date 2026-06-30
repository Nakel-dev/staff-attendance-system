"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanFace, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFaceModels } from "@/lib/face/client";
import {
  MIN_LIVENESS_FRAMES,
  pickBestDescriptor,
  validateLivenessFrames,
} from "@/lib/face/liveness";

export interface VideoVerificationResult {
  videoBlob: Blob;
  faceDescriptor: number[];
  frameDescriptors: number[][];
  motionScore: number;
  previewUrl: string;
}

interface VideoVerificationCaptureProps {
  label?: string;
  hint?: string;
  disabled?: boolean;
  onVerified: (result: VideoVerificationResult) => void;
}

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

export function VideoVerificationCapture({
  label = "Video verification",
  hint = "Center your face, then record a 3-second clip. Slowly turn your head left and right.",
  disabled,
  onVerified,
}: VideoVerificationCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setError("Camera access is required for video verification");
    }
  };

  const startRecording = async () => {
    if (!videoRef.current || !streamRef.current || recording || processing) return;
    setError(null);
    setRecording(true);
    setProgress("Recording… move your head slowly");
    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.start(200);
    const faceapi = await import("@vladmandic/face-api");
    const frameDescriptors: number[][] = [];
    const startedAt = Date.now();

    while (Date.now() - startedAt < 3000) {
      if (!videoRef.current) break;
      const descriptor = await captureFrameDescriptor(videoRef.current, faceapi);
      if (descriptor) frameDescriptors.push(descriptor);
      setProgress(`Recording… ${Math.min(100, Math.round(((Date.now() - startedAt) / 3000) * 100))}%`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    recorder.stop();
    setRecording(false);
    setProcessing(true);
    setProgress("Analyzing liveness…");

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    const liveness = validateLivenessFrames(frameDescriptors);
    if (!liveness.passed) {
      setProcessing(false);
      setProgress("");
      setError(liveness.reason || "Video verification failed");
      return;
    }

    const videoBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
    const faceDescriptor = pickBestDescriptor(frameDescriptors);
    const previewUrl = URL.createObjectURL(videoBlob);

    setProcessing(false);
    setProgress("Verification passed");
    onVerified({
      videoBlob,
      faceDescriptor,
      frameDescriptors,
      motionScore: liveness.motionScore,
      previewUrl,
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Video className="h-4 w-4" />
        {label}
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>

      {cameraReady ? (
        <video ref={videoRef} className="w-full max-w-sm rounded-lg border" playsInline muted />
      ) : (
        <Button type="button" onClick={startCamera} disabled={disabled || processing}>
          <ScanFace className="mr-2 h-4 w-4" />
          Enable camera
        </Button>
      )}

      {cameraReady && (
        <Button
          type="button"
          onClick={startRecording}
          disabled={disabled || recording || processing}
          className="w-full sm:w-auto"
        >
          {recording || processing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Video className="mr-2 h-4 w-4" />
          )}
          Record 3-second verification
        </Button>
      )}

      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Requires at least {MIN_LIVENESS_FRAMES} live frames with natural head movement (OPay-style liveness).
      </p>
    </div>
  );
}
