"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractFaceDescriptorFromVideo,
  freezeVideoFrame,
} from "@/lib/face/client";

export type LiveFaceVerifyResult = {
  blob: Blob;
  descriptor: number[];
};

/** Single live selfie + face descriptor for clock matching against enrollment. */
export function LiveFaceVerifyCapture({
  onCapture,
  disabled,
}: {
  onCapture: (result: LiveFaceVerifyResult) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(true);
  const [busy, setBusy] = useState(false);
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
      setError("Could not access camera. Allow permission and try again.");
    } finally {
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const descriptor = await extractFaceDescriptorFromVideo(video);
      const canvas = freezeVideoFrame(video, 720);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("Could not capture photo");
      stopCamera();
      onCapture({ blob, descriptor });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face not detected. Try again.");
      setBusy(false);
    }
  };

  if (error && starting === false && !streamRef.current) {
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <p className="text-muted-foreground text-center text-sm">
        Look straight at the camera. We match this live face to the one from your signup.
      </p>
      <Button className="w-full" size="lg" onClick={() => void capture()} disabled={disabled || busy || starting}>
        <Camera className="mr-2 h-5 w-5" />
        {busy ? "Verifying face…" : "Capture & verify"}
      </Button>
    </div>
  );
}
