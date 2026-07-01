"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KioskPhotoCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

export function KioskPhotoCapture({ onCapture, disabled }: KioskPhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStarting(true);
    setCameraError(null);
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
      setCameraError("Could not access camera. Allow camera permission and try again.");
    } finally {
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || disabled) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    void startCamera();
  };

  const confirm = () => {
    if (previewBlob) onCapture(previewBlob);
  };

  if (cameraError) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-destructive text-sm">{cameraError}</p>
        <Button onClick={() => void startCamera()}>Retry camera</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-black">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Captured preview" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
              playsInline
              muted
            />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-muted-foreground text-center text-sm">
        Look at the camera and take a clear photo of your face for attendance.
      </p>
      {!previewUrl ? (
        <Button className="w-full" size="lg" onClick={takePhoto} disabled={disabled || starting}>
          <Camera className="mr-2 h-5 w-5" />
          Take photo
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={retake} disabled={disabled}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Retake
          </Button>
          <Button className="flex-1" onClick={confirm} disabled={disabled}>
            Use this photo
          </Button>
        </div>
      )}
    </div>
  );
}
