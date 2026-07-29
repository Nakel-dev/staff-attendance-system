"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

const RECORD_MS = 3000;

async function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture face snapshot");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture face snapshot"))),
      "image/jpeg",
      0.88
    );
  });
}

interface KioskVideoCaptureProps {
  staffName: string;
  attemptType: "check_in" | "check_out";
  onCapture: (payload: { video: Blob; snapshot: Blob }) => void;
  disabled?: boolean;
}

/** Record a short verification clip at the reception kiosk (MediaRecorder, no ML). */
export function KioskVideoCapture({
  staffName,
  attemptType,
  onCapture,
  disabled,
}: KioskVideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(true);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStarting(true);
      setError(null);
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 24 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Could not access kiosk camera. Allow camera permission.");
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const recordClip = async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video || disabled || recording || done) return;

    setRecording(true);
    setError(null);
    setProgress("Recording… look at the camera");

    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("Recording failed"));
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size < 500) reject(new Error("Video too short — try again"));
          else resolve(blob);
        };
      });

      recorder.start(200);
      const started = Date.now();
      const tick = setInterval(() => {
        const left = Math.max(0, RECORD_MS - (Date.now() - started));
        setProgress(`Recording… ${Math.ceil(left / 1000)}s`);
      }, 200);

      await new Promise((r) => setTimeout(r, RECORD_MS));
      clearInterval(tick);

      const snapshot = await captureVideoFrame(video);
      recorder.stop();
      stopCamera();

      const blob = await finished;
      setDone(true);
      setProgress("Video captured");
      onCapture({ video: blob, snapshot });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed");
      setRecording(false);
      setProgress("");
    }
  };

  const actionLabel = attemptType === "check_in" ? "check-in" : "check-out";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-lg font-semibold">{staffName}</p>
        <p className="text-muted-foreground text-sm capitalize">Confirm {actionLabel} · 3 second video</p>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          playsInline
          muted
          autoPlay
        />
        {(starting || recording) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">{progress || "Starting camera…"}</p>
          </div>
        )}
      </div>

      {error && <p className="text-destructive text-center text-sm">{error}</p>}

      <Button
        className="w-full"
        size="lg"
        onClick={() => void recordClip()}
        disabled={disabled || starting || recording || done}
      >
        <Video className="mr-2 h-5 w-5" />
        {done ? "Video saved" : recording ? "Recording…" : "Record 3 second verification"}
      </Button>
    </div>
  );
}
