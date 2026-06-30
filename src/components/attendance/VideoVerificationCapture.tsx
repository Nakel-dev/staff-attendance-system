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

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access in your browser settings, then try again.";
    }
    if (error.name === "NotFoundError") {
      return "No camera was found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is already in use by another app. Close other apps using the camera and try again.";
    }
    if (error.name === "SecurityError") {
      return "Camera access requires a secure connection (HTTPS). Open the app over HTTPS and try again.";
    }
    return error.message || "Could not access the camera.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Could not access the camera.";
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
  const [startingCamera, setStartingCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const attachStream = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (playError) {
      throw new Error(getCameraErrorMessage(playError));
    }
  }, []);

  useEffect(() => {
    if (!cameraReady) return;
    void attachStream().catch((attachError) => {
      setError(getCameraErrorMessage(attachError));
      stopCamera();
    });
  }, [cameraReady, attachStream, stopCamera]);

  const startCamera = async () => {
    setError(null);
    setStartingCamera(true);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStartingCamera(false);
      setError("Camera access requires HTTPS. Use the deployed app URL or localhost.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStartingCamera(false);
      setError("This browser does not support camera access.");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraReady(true);
    } catch (cameraError) {
      setError(getCameraErrorMessage(cameraError));
      stopCamera();
    } finally {
      setStartingCamera(false);
    }
  };

  const startRecording = async () => {
    if (!videoRef.current || !streamRef.current || recording || processing) return;
    setError(null);
    setRecording(true);
    setProgress("Loading face models…");
    chunksRef.current = [];

    try {
      await loadFaceModels();
    } catch (modelError) {
      setRecording(false);
      setProgress("");
      setError(
        modelError instanceof Error
          ? `Face models failed to load: ${modelError.message}`
          : "Face models failed to load. Check your connection and try again."
      );
      return;
    }

    setProgress("Recording… move your head slowly");

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

      <video
        ref={videoRef}
        className={`w-full max-w-sm rounded-lg border bg-black ${cameraReady ? "block" : "hidden"}`}
        playsInline
        muted
        autoPlay
      />

      {!cameraReady ? (
        <Button type="button" onClick={startCamera} disabled={disabled || processing || startingCamera}>
          {startingCamera ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ScanFace className="mr-2 h-4 w-4" />
          )}
          Enable camera
        </Button>
      ) : (
        <>
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
          <Button type="button" variant="outline" onClick={stopCamera} disabled={recording || processing}>
            Stop camera
          </Button>
        </>
      )}

      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={startingCamera}>
            Try again
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Requires at least {MIN_LIVENESS_FRAMES} live frames with natural head movement.
      </p>
    </div>
  );
}
