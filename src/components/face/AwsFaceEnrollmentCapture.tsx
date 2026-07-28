"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AwsFaceEnrollmentResult = {
  enrolledAt: string;
  similarity: number;
};

/** Single live selfie sent to AWS CompareFaces — no local face-api models. */
export function AwsFaceEnrollmentCapture({
  onSuccess,
  onStop,
  disabled,
}: {
  onSuccess: (result: AwsFaceEnrollmentResult) => void;
  onStop?: () => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [starting, setStarting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

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
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const captureAndVerify = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || disabled || busy) return;

    setBusy(true);
    setError(null);
    setStatus("Capturing photo…");

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      setStatus(null);
      setError("Could not capture photo.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) {
      setBusy(false);
      setStatus(null);
      setError("Could not capture photo.");
      return;
    }

    stopCamera();
    setStatus("Verifying with AWS Rekognition…");

    try {
      const form = new FormData();
      form.append("file", blob, "live.jpg");
      const res = await fetch("/api/staff/aws/verify", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        enrolledAt?: string;
        similarity?: number;
      };
      if (!res.ok) {
        throw new Error(data.error || "AWS verification failed");
      }

      onSuccess({
        enrolledAt: data.enrolledAt || new Date().toISOString(),
        similarity: Number(data.similarity || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AWS verification failed");
      setStatus(null);
      setBusy(false);
      void startCamera();
    }
  };

  const handleStop = () => {
    stopCamera();
    onStop?.();
  };

  if (error && !streamRef.current && !starting) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <Button onClick={() => void startCamera()}>Retry camera</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          playsInline
          muted
        />
        {(starting || busy) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-4 text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">{status || "Starting camera…"}</p>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {error && streamRef.current && (
        <p className="text-destructive text-center text-sm">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        <Button onClick={() => void captureAndVerify()} disabled={disabled || busy || starting} size="lg">
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          {busy ? "Verifying with AWS…" : "Capture & verify with AWS"}
        </Button>
        <Button type="button" variant="outline" onClick={handleStop} disabled={busy}>
          Stop camera
        </Button>
      </div>
    </div>
  );
}
