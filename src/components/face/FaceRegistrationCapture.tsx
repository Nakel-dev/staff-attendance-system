"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectFaceDescriptor,
  detectFacePose,
  loadFaceRegistrationModels,
} from "@/lib/face/client";
import { estimateHeadPose, matchesTargetAngle } from "@/lib/face/pose";
import { validateLivenessFrames } from "@/lib/face/liveness";
import {
  FACE_ANGLE_PROMPTS,
  shuffleAngles,
  type FaceAngle,
} from "@/lib/kiosk/constants";

export interface AngleCaptureResult {
  angle: FaceAngle;
  descriptor: number[];
}

export interface FaceRegistrationCaptureResult {
  angles: AngleCaptureResult[];
  frameDescriptors: number[][];
  motionScore: number;
  referenceClipBlob?: Blob;
}

interface FaceRegistrationCaptureProps {
  onComplete: (result: FaceRegistrationCaptureResult) => void;
  disabled?: boolean;
}

const POSE_INTERVAL_MS = 900;
const HOLD_MS = 900;
const DESCRIPTOR_SAMPLE_MS = 1200;

export function FaceRegistrationCapture({ onComplete, disabled }: FaceRegistrationCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameDescriptorsRef = useRef<number[][]>([]);
  const capturedRef = useRef<AngleCaptureResult[]>([]);
  const stepRef = useRef(0);
  const holdStartRef = useRef<number | null>(null);
  const completingRef = useRef(false);
  const detectingRef = useRef(false);
  const lastDescriptorSampleRef = useRef(0);

  const [sequence] = useState(() => shuffleAngles());
  const [stepIndex, setStepIndex] = useState(0);
  const [captured, setCaptured] = useState<AngleCaptureResult[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Enable camera to begin");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const finishCapture = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    recorderRef.current?.stop();
    const liveness = validateLivenessFrames(frameDescriptorsRef.current);
    if (!liveness.passed) {
      completingRef.current = false;
      setError(liveness.reason || "Liveness check failed. Move your head slowly and try again.");
      capturedRef.current = [];
      stepRef.current = 0;
      setCaptured([]);
      setStepIndex(0);
      setStatus(FACE_ANGLE_PROMPTS[sequence[0]]);
      return;
    }
    const blob = new Blob(chunksRef.current, {
      type: recorderRef.current?.mimeType || "video/webm",
    });
    onComplete({
      angles: capturedRef.current,
      frameDescriptors: frameDescriptorsRef.current,
      motionScore: liveness.motionScore,
      referenceClipBlob: blob,
    });
    setStatus("Registration capture complete");
    stopCamera();
  }, [onComplete, sequence, stopCamera]);

  const startCamera = async () => {
    setError(null);
    setLoading(true);
    setStatus("Loading face models…");
    completingRef.current = false;
    detectingRef.current = false;
    capturedRef.current = [];
    stepRef.current = 0;
    holdStartRef.current = null;
    lastDescriptorSampleRef.current = 0;
    setCaptured([]);
    setStepIndex(0);
    setHoldProgress(0);

    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error("Camera requires HTTPS or localhost.");
      }
      stopCamera();
      await loadFaceRegistrationModels();
      setStatus("Starting camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      chunksRef.current = [];
      frameDescriptorsRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(400);
      recorderRef.current = recorder;
      setCameraReady(true);
      setStatus(FACE_ANGLE_PROMPTS[sequence[0]]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera failed");
      stopCamera();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cameraReady || completingRef.current) return;

    const interval = setInterval(() => {
      void (async () => {
        if (detectingRef.current || completingRef.current) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        detectingRef.current = true;
        try {
          const detection = await detectFacePose(video);
          if (!detection) {
            holdStartRef.current = null;
            setHoldProgress(0);
            return;
          }

          const now = Date.now();
          if (now - lastDescriptorSampleRef.current >= DESCRIPTOR_SAMPLE_MS) {
            lastDescriptorSampleRef.current = now;
            const full = await detectFaceDescriptor(video);
            if (full) frameDescriptorsRef.current.push(full.descriptor);
          }

          const angle = sequence[stepRef.current];
          const pose = estimateHeadPose(detection.landmarks);

          if (!matchesTargetAngle(pose, angle)) {
            holdStartRef.current = null;
            setHoldProgress(0);
            return;
          }

          if (!holdStartRef.current) holdStartRef.current = Date.now();
          const elapsed = Date.now() - holdStartRef.current;
          setHoldProgress(Math.min(100, Math.round((elapsed / HOLD_MS) * 100)));

          if (elapsed < HOLD_MS) return;

          const full = await detectFaceDescriptor(video);
          if (!full) {
            holdStartRef.current = null;
            setHoldProgress(0);
            setStatus("Hold steady — face not clear enough. Try again.");
            return;
          }

          const entry = { angle, descriptor: full.descriptor };
          capturedRef.current = [...capturedRef.current, entry];
          setCaptured([...capturedRef.current]);
          holdStartRef.current = null;
          setHoldProgress(0);

          if (stepRef.current + 1 >= sequence.length) {
            clearInterval(interval);
            await finishCapture();
            return;
          }

          stepRef.current += 1;
          setStepIndex(stepRef.current);
          setStatus(FACE_ANGLE_PROMPTS[sequence[stepRef.current]]);
        } catch {
          holdStartRef.current = null;
          setHoldProgress(0);
        } finally {
          detectingRef.current = false;
        }
      })();
    }, POSE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [cameraReady, finishCapture, sequence]);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full rounded-2xl bg-black object-cover ${cameraReady ? "block" : "hidden"}`}
          playsInline
          muted
          autoPlay
        />
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border bg-muted">
            <ScanFace className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`h-56 w-56 rounded-full border-4 transition-colors ${
              holdProgress > 0
                ? "border-green-500 shadow-[0_0_0_8px_rgba(34,197,94,0.25)]"
                : "border-primary/80"
            }`}
          />
        </div>
        {cameraReady && (
          <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 p-3 text-center text-sm text-white">
            {status}
            {holdProgress > 0 && <div className="mt-1 text-xs">Hold still… {holdProgress}%</div>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {sequence.map((angle, index) => {
          const done = captured.some((c) => c.angle === angle);
          const active = index === stepIndex && cameraReady;
          return (
            <span
              key={angle}
              className={`rounded-full px-3 py-1 text-xs ${
                done
                  ? "bg-green-500/15 text-green-700"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
              {angle}
            </span>
          );
        })}
      </div>

      {!cameraReady && (
        <Button type="button" onClick={startCamera} disabled={disabled || loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
          {loading ? "Preparing camera…" : "Enable camera"}
        </Button>
      )}

      {cameraReady && (
        <Button type="button" variant="outline" className="w-full" onClick={stopCamera}>
          Stop camera
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
