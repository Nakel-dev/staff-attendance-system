export const MIN_LIVENESS_FRAMES = 5;
export const MIN_MOTION_SCORE = 0.035;
export const MAX_FRAME_DESCRIPTOR_DISTANCE = 0.45;
export const MIN_LANDMARK_PIXEL_MOTION = 1.4;
export const MAX_LANDMARK_FRAME_DISTANCE = 42;

export function landmarkDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY;
  let total = 0;
  let points = 0;
  for (let i = 0; i < a.length; i += 2) {
    const dx = a[i] - b[i];
    const dy = a[i + 1] - b[i + 1];
    total += Math.sqrt(dx * dx + dy * dy);
    points += 1;
  }
  return points > 0 ? total / points : Number.POSITIVE_INFINITY;
}

export function computeLandmarkMotionScore(landmarkFrames: number[][]): number {
  if (landmarkFrames.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 1; i < landmarkFrames.length; i++) {
    total += landmarkDistance(landmarkFrames[i - 1], landmarkFrames[i]);
    pairs += 1;
  }
  return pairs > 0 ? total / pairs : 0;
}

/** Map average landmark movement (224px canvas) to 0–1 for server checks. */
export function normalizeLandmarkMotionScore(avgPixelMotion: number): number {
  return Math.min(1, avgPixelMotion / 40);
}

export function validateLivenessLandmarkFrames(
  landmarkFrames: number[][],
  options?: { minFrames?: number; minPixelMotion?: number }
): {
  passed: boolean;
  motionScore: number;
  reason?: string;
} {
  const minFrames = options?.minFrames ?? MIN_LIVENESS_FRAMES;
  const minPixelMotion = options?.minPixelMotion ?? MIN_LANDMARK_PIXEL_MOTION;

  if (landmarkFrames.length < minFrames) {
    return {
      passed: false,
      motionScore: 0,
      reason: `Need at least ${minFrames} live frames — keep your face centered and move your head slowly.`,
    };
  }

  const pixelMotion = computeLandmarkMotionScore(landmarkFrames);
  const motionScore = normalizeLandmarkMotionScore(pixelMotion);
  if (pixelMotion < minPixelMotion) {
    return {
      passed: false,
      motionScore,
      reason: "Live video required — static photos and phone screens are not accepted.",
    };
  }

  const first = landmarkFrames[0];
  const allSamePerson = landmarkFrames.every(
    (frame) => landmarkDistance(first, frame) <= MAX_LANDMARK_FRAME_DISTANCE
  );
  if (!allSamePerson) {
    return {
      passed: false,
      motionScore,
      reason: "Face changed during recording — please record again.",
    };
  }

  return { passed: true, motionScore };
}

export const MIN_PIXEL_FRAME_DIFF = 4;
export const MIN_PIXEL_MOTION_FRAMES = 5;

/** Map average grayscale frame diff (0–255) to 0–1 for server checks. */
export function normalizePixelMotionScore(avgDiff: number): number {
  return Math.min(1, avgDiff / 25);
}

/** Validates live camera motion from consecutive video frame diffs — no ML required. */
export function validatePixelMotionSamples(
  frameDiffs: number[],
  options?: { minFrames?: number; minAvgDiff?: number }
): {
  passed: boolean;
  motionScore: number;
  reason?: string;
} {
  const minFrames = options?.minFrames ?? MIN_PIXEL_MOTION_FRAMES;
  const minAvgDiff = options?.minAvgDiff ?? MIN_PIXEL_FRAME_DIFF;

  if (frameDiffs.length < minFrames) {
    return {
      passed: false,
      motionScore: 0,
      reason: `Need at least ${minFrames} live frames — keep your face in view and move your head slowly.`,
    };
  }

  const avgDiff = frameDiffs.reduce((sum, value) => sum + value, 0) / frameDiffs.length;
  const motionScore = normalizePixelMotionScore(avgDiff);
  if (avgDiff < minAvgDiff) {
    return {
      passed: false,
      motionScore,
      reason: "Live video required — static photos and phone screens are not accepted.",
    };
  }

  return { passed: true, motionScore };
}

export function descriptorDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function computeMotionScore(frameDescriptors: number[][]): number {
  if (frameDescriptors.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 1; i < frameDescriptors.length; i++) {
    total += descriptorDistance(frameDescriptors[i - 1], frameDescriptors[i]);
    pairs += 1;
  }
  return pairs > 0 ? total / pairs : 0;
}

export function validateLivenessFrames(
  frameDescriptors: number[][],
  options?: { minFrames?: number; minMotionScore?: number }
): {
  passed: boolean;
  motionScore: number;
  reason?: string;
} {
  const minFrames = options?.minFrames ?? MIN_LIVENESS_FRAMES;
  const minMotion = options?.minMotionScore ?? MIN_MOTION_SCORE;

  if (frameDescriptors.length < minFrames) {
    return {
      passed: false,
      motionScore: 0,
      reason: `Need at least ${minFrames} live video frames`,
    };
  }

  const motionScore = computeMotionScore(frameDescriptors);
  if (motionScore < minMotion) {
    return {
      passed: false,
      motionScore,
      reason: "Live video required — static photos are not accepted",
    };
  }

  const first = frameDescriptors[0];
  const allSamePerson = frameDescriptors.every(
    (descriptor) => descriptorDistance(first, descriptor) <= MAX_FRAME_DESCRIPTOR_DISTANCE
  );

  if (!allSamePerson) {
    return {
      passed: false,
      motionScore,
      reason: "Face changed during recording — please record again",
    };
  }

  return { passed: true, motionScore };
}

export function pickBestDescriptor(frameDescriptors: number[][]): number[] {
  if (frameDescriptors.length === 0) {
    throw new Error("No face frames captured");
  }
  return frameDescriptors[Math.floor(frameDescriptors.length / 2)];
}
