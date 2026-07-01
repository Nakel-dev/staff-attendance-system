export const MIN_LIVENESS_FRAMES = 8;
export const MIN_MOTION_SCORE = 0.035;
export const MAX_FRAME_DESCRIPTOR_DISTANCE = 0.45;

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
