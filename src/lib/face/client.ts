"use client";

import type { FaceAngle } from "@/lib/kiosk/constants";
import { estimateHeadPose, matchesTargetAngle } from "@/lib/face/pose";

let registrationModelsLoaded = false;
let recognitionModelLoaded = false;
let tfReady = false;

const MODEL_URL = "/models";
const DESCRIPTOR_OPTIONS = { inputSize: 224, scoreThreshold: 0.5 } as const;

let registrationFaceApi: typeof import("@vladmandic/face-api") | null = null;

function yieldToBrowser(ms = 32): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initTensorFlow(faceapi: typeof import("@vladmandic/face-api")) {
  if (tfReady) return;
  const tf = faceapi.tf as unknown as {
    setBackend: (backend: string) => Promise<boolean>;
    ready: () => Promise<void>;
  };
  // CPU first — avoids WebGL shader compile freezes on many laptops.
  const backends = ["cpu", "webgl"] as const;
  for (const backend of backends) {
    try {
      const ok = await tf.setBackend(backend);
      if (ok) {
        await tf.ready();
        tfReady = true;
        return;
      }
    } catch {
      // try next backend
    }
  }
  throw new Error("Could not initialize face AI. Refresh and try again.");
}

async function loadModelUrl(url: string) {
  const faceapi = await import("@vladmandic/face-api");
  await initTensorFlow(faceapi);
  registrationFaceApi = faceapi;
  await faceapi.nets.tinyFaceDetector.loadFromUri(url);
  return faceapi;
}

async function loadRecognitionUrl(url: string) {
  const faceapi = registrationFaceApi ?? (await import("@vladmandic/face-api"));
  await initTensorFlow(faceapi);
  registrationFaceApi = faceapi;
  await faceapi.nets.faceRecognitionNet.loadFromUri(url);
  recognitionModelLoaded = true;
  return faceapi;
}

/** Load detector only — fast, used before first capture. */
export async function loadRegistrationDetector() {
  if (registrationModelsLoaded && registrationFaceApi) return registrationFaceApi;
  try {
    await loadModelUrl(MODEL_URL);
  } catch {
    await loadModelUrl("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model");
  }
  registrationModelsLoaded = true;
  return registrationFaceApi!;
}

/** Load recognition net on first capture (heavier). */
export async function loadRegistrationRecognitionModel() {
  if (recognitionModelLoaded && registrationFaceApi) return registrationFaceApi;
  await loadRegistrationDetector();
  try {
    await loadRecognitionUrl(MODEL_URL);
  } catch {
    await loadRecognitionUrl("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model");
  }
  return registrationFaceApi!;
}

export async function loadFaceRegistrationModels() {
  return loadRegistrationRecognitionModel();
}

export function freezeVideoFrame(video: HTMLVideoElement, maxDim = 280): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = document.createElement("canvas");
  if (!w || !h) {
    canvas.width = 280;
    canvas.height = 280;
    return canvas;
  }
  const scale = Math.min(1, maxDim / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export type CaptureAngleResult =
  | { ok: true; descriptor: number[]; angle: FaceAngle }
  | { ok: false; reason: string };

export async function captureRegistrationAngle(
  video: HTMLVideoElement,
  expectedAngle: FaceAngle
): Promise<CaptureAngleResult> {
  await yieldToBrowser(64);
  const faceapi = await loadRegistrationRecognitionModel();
  await yieldToBrowser(32);

  const canvas = freezeVideoFrame(video, 280);
  const options = new faceapi.TinyFaceDetectorOptions(DESCRIPTOR_OPTIONS);

  const tf = faceapi.tf as unknown as {
    engine: () => { startScope: () => void; endScope: () => void };
  };

  tf.engine().startScope();
  try {
    const detection = await faceapi
      .detectSingleFace(canvas, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection?.descriptor) {
      return {
        ok: false,
        reason: "No face detected. Center your face in the circle with good lighting.",
      };
    }

    const pose = estimateHeadPose(detection.landmarks);
    if (!matchesTargetAngle(pose, expectedAngle)) {
      return {
        ok: false,
        reason: angleHint(expectedAngle),
      };
    }

    return {
      ok: true,
      descriptor: Array.from(detection.descriptor),
      angle: expectedAngle,
    };
  } finally {
    tf.engine().endScope();
    await yieldToBrowser(16);
  }
}

function angleHint(angle: FaceAngle): string {
  switch (angle) {
    case "front":
      return "Look straight at the camera, then tap Capture again.";
    case "left":
      return "Turn your head to YOUR left (camera sees right cheek), then tap Capture.";
    case "right":
      return "Turn your head to YOUR right (camera sees left cheek), then tap Capture.";
    case "up":
      return "Tilt your head up slightly, then tap Capture.";
    case "down":
      return "Tilt your head down slightly, then tap Capture.";
    default:
      return "Adjust your head to match the prompt, then tap Capture.";
  }
}

// --- Legacy exports used elsewhere ---

let modelsLoaded = false;

async function loadModelsFrom(url: string) {
  const faceapi = await import("@vladmandic/face-api");
  await initTensorFlow(faceapi);
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(url),
    faceapi.nets.faceLandmark68Net.loadFromUri(url),
    faceapi.nets.faceRecognitionNet.loadFromUri(url),
  ]);
}

export async function loadFaceModels() {
  if (modelsLoaded) return;
  try {
    await loadModelsFrom(MODEL_URL);
  } catch {
    await loadModelsFrom("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model");
  }
  modelsLoaded = true;
}

export async function detectRegistrationPose(video: HTMLVideoElement) {
  await loadRegistrationDetector();
  const faceapi = registrationFaceApi!;
  const canvas = freezeVideoFrame(video, 224);
  const options = new faceapi.TinyFaceDetectorOptions(DESCRIPTOR_OPTIONS);
  const detection = await faceapi.detectSingleFace(canvas, options).withFaceLandmarks(true);
  if (!detection) return null;
  return { landmarks: detection.landmarks };
}

export async function detectRegistrationDescriptor(video: HTMLVideoElement) {
  const result = await captureRegistrationAngle(video, "front");
  if (!result.ok) return null;
  return { descriptor: result.descriptor, landmarks: null };
}

export async function detectRegistrationFrame(
  video: HTMLVideoElement,
  withDescriptor: boolean
) {
  if (withDescriptor) return detectRegistrationDescriptor(video);
  return detectRegistrationPose(video);
}

export async function detectFacePose(video: HTMLVideoElement) {
  return detectRegistrationPose(video);
}

export async function detectFaceDescriptor(video: HTMLVideoElement) {
  return detectRegistrationDescriptor(video);
}

async function detectSingleDescriptor(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
  const faceapi = await import("@vladmandic/face-api");
  await initTensorFlow(faceapi);
  const detection = await faceapi
    .detectSingleFace(input)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) {
    throw new Error("No face detected. Look at the camera with good lighting and try again.");
  }
  return Array.from(detection.descriptor);
}

export async function extractFaceDescriptorFromFile(file: File): Promise<number[]> {
  await loadFaceModels();
  const faceapi = await import("@vladmandic/face-api");
  const url = URL.createObjectURL(file);
  try {
    const img = await faceapi.fetchImage(url);
    return detectSingleDescriptor(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractFaceDescriptorFromVideo(video: HTMLVideoElement): Promise<number[]> {
  await loadFaceModels();
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve();
    });
  }
  return detectSingleDescriptor(video);
}

export function parseCheckInQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { t?: string; token?: string };
    return (parsed.t || parsed.token || "").trim().toUpperCase() || null;
  } catch {
    return trimmed.toUpperCase();
  }
}
