"use client";

let modelsLoaded = false;

const MODEL_URL = "/models";

async function loadModelsFrom(url: string) {
  const faceapi = await import("@vladmandic/face-api");
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

async function detectSingleDescriptor(input: HTMLImageElement | HTMLVideoElement) {
  const faceapi = await import("@vladmandic/face-api");
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
