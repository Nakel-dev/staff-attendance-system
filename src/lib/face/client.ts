"use client";

let modelsLoaded = false;
let registrationModelsLoaded = false;
let tfReady = false;

const MODEL_URL = "/models";
const TINY_DETECTOR_OPTIONS = { inputSize: 224, scoreThreshold: 0.55 } as const;
const DESCRIPTOR_DETECTOR_OPTIONS = { inputSize: 320, scoreThreshold: 0.5 } as const;

let registrationFaceApi: typeof import("@vladmandic/face-api") | null = null;

function yieldToBrowser(ms = 16): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let detectionCanvas: HTMLCanvasElement | null = null;
let detectionCtx: CanvasRenderingContext2D | null = null;

function getDetectionInput(
  video: HTMLVideoElement,
  forDescriptor = false
): HTMLVideoElement | HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return video;

  const maxDim = forDescriptor ? 384 : 256;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  if (scale >= 1) return video;

  if (!detectionCanvas) {
    detectionCanvas = document.createElement("canvas");
    detectionCtx = detectionCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!detectionCtx) return video;

  detectionCanvas.width = Math.round(w * scale);
  detectionCanvas.height = Math.round(h * scale);
  detectionCtx.drawImage(video, 0, 0, detectionCanvas.width, detectionCanvas.height);
  return detectionCanvas;
}

async function initTensorFlow(faceapi: typeof import("@vladmandic/face-api")) {
  if (tfReady) return;
  const tf = faceapi.tf as unknown as {
    setBackend: (backend: string) => Promise<boolean>;
    ready: () => Promise<void>;
  };
  const backends = ["webgl", "cpu"] as const;
  let initialized = false;
  for (const backend of backends) {
    try {
      const ok = await tf.setBackend(backend);
      if (ok) {
        await tf.ready();
        initialized = true;
        break;
      }
    } catch {
      // try next backend
    }
  }
  if (!initialized) {
    throw new Error("Could not initialize TensorFlow.js. Try refreshing the page.");
  }
  tfReady = true;
}

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
  } catch (localError) {
    try {
      await loadModelsFrom("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model");
    } catch {
      tfReady = false;
      throw localError instanceof Error
        ? localError
        : new Error("Failed to load face models");
    }
  }
  modelsLoaded = true;
}

async function loadRegistrationModelsFrom(url: string) {
  const faceapi = await import("@vladmandic/face-api");
  await initTensorFlow(faceapi);
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(url),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(url),
    faceapi.nets.faceRecognitionNet.loadFromUri(url),
  ]);
  registrationFaceApi = faceapi;
  return faceapi;
}

export async function loadFaceRegistrationModels() {
  if (registrationModelsLoaded && registrationFaceApi) {
    return registrationFaceApi;
  }
  try {
    await loadRegistrationModelsFrom(MODEL_URL);
  } catch (localError) {
    try {
      await loadRegistrationModelsFrom(
        "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"
      );
    } catch {
      tfReady = false;
      throw localError instanceof Error
        ? localError
        : new Error("Failed to load face models");
    }
  }
  registrationModelsLoaded = true;
  modelsLoaded = true;
  return registrationFaceApi!;
}

/** Fast pose tracking — tiny detector + tiny landmarks only (no descriptor). */
export async function detectRegistrationPose(video: HTMLVideoElement) {
  const faceapi = await loadFaceRegistrationModels();
  const input = getDetectionInput(video, false);
  const options = new faceapi.TinyFaceDetectorOptions(TINY_DETECTOR_OPTIONS);
  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks(true);
  if (!detection) return null;
  return { landmarks: detection.landmarks };
}

/** Heavy path — run once per captured angle only. */
export async function detectRegistrationDescriptor(video: HTMLVideoElement) {
  const faceapi = await loadFaceRegistrationModels();
  await yieldToBrowser();
  const input = getDetectionInput(video, true);
  const options = new faceapi.TinyFaceDetectorOptions(DESCRIPTOR_DETECTOR_OPTIONS);
  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  if (!detection?.descriptor) return null;
  return {
    landmarks: detection.landmarks,
    descriptor: Array.from(detection.descriptor),
  };
}

/** @deprecated Use detectRegistrationPose or detectRegistrationDescriptor */
export async function detectRegistrationFrame(
  video: HTMLVideoElement,
  withDescriptor: boolean
) {
  if (withDescriptor) {
    return detectRegistrationDescriptor(video);
  }
  return detectRegistrationPose(video);
}

export async function detectFacePose(video: HTMLVideoElement) {
  return detectRegistrationPose(video);
}

export async function detectFaceDescriptor(video: HTMLVideoElement) {
  return detectRegistrationDescriptor(video);
}

async function detectSingleDescriptor(input: HTMLImageElement | HTMLVideoElement) {
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
