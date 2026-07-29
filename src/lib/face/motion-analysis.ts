/** Head-turn motion analysis — lightweight, no ML. Shared by browser and server. */

export const MOTION_SAMPLE_SIZE = 96;
export const MIN_MOTION_FRAME_PAIRS = 6;
export const MIN_AVG_FRAME_DIFF = 9;
export const MIN_CENTROID_DRIFT = 0.06;
export const MIN_ASYMMETRY_RATIO = 0.14;
export const MIN_ASYMMETRIC_FRAME_COUNT = 2;
export const MAX_UNIFORM_ASYMMETRY = 0.06;
export const MIN_CENTER_MOTION_RATIO = 0.72;
export const MIN_DIFF_COEFFICIENT_OF_VARIATION = 0.12;

export type GrayscaleMotionPair = {
  avgDiff: number;
  leftDiff: number;
  rightDiff: number;
  centroidX: number;
  asymmetry: number;
  centerRatio: number;
};

export function analyzeGrayscalePair(
  a: Uint8Array,
  b: Uint8Array,
  size = MOTION_SAMPLE_SIZE
): GrayscaleMotionPair {
  const half = size / 2;
  const cx0 = size * 0.25;
  const cx1 = size * 0.75;
  const cy0 = size * 0.15;
  const cy1 = size * 0.85;

  let total = 0;
  let leftSum = 0;
  let rightSum = 0;
  let centerSum = 0;
  let outerSum = 0;
  let leftCount = 0;
  let rightCount = 0;
  let centerCount = 0;
  let outerCount = 0;
  let weightedX = 0;
  let weightSum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const diff = Math.abs(a[i] - b[i]);
      total += diff;

      if (x < half) {
        leftSum += diff;
        leftCount += 1;
      } else {
        rightSum += diff;
        rightCount += 1;
      }

      const inCenter = x >= cx0 && x < cx1 && y >= cy0 && y < cy1;
      if (inCenter) {
        centerSum += diff;
        centerCount += 1;
      } else {
        outerSum += diff;
        outerCount += 1;
      }

      if (diff > 3) {
        weightedX += x * diff;
        weightSum += diff;
      }
    }
  }

  const pixels = size * size;
  const avgDiff = total / pixels;
  const leftDiff = leftSum / leftCount;
  const rightDiff = rightSum / rightCount;
  const centerDiff = centerSum / centerCount;
  const outerDiff = outerSum / outerCount;
  const centroidX = weightSum > 0 ? weightedX / weightSum / size : 0.5;
  const asymmetry = Math.abs(leftDiff - rightDiff) / (leftDiff + rightDiff + 1e-6);
  const centerRatio = centerDiff / (outerDiff + 1e-6);

  return { avgDiff, leftDiff, rightDiff, centroidX, asymmetry, centerRatio };
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean < 1e-6) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Validates a sequence of grayscale frames — rejects static photos and phone-shake spoofing. */
export function validateGrayscaleMotionSequence(grays: Uint8Array[]): {
  passed: boolean;
  motionScore: number;
  frameDiffs: number[];
  reason?: string;
} {
  if (grays.length < MIN_MOTION_FRAME_PAIRS + 1) {
    return {
      passed: false,
      motionScore: 0,
      frameDiffs: [],
      reason: `Need at least ${MIN_MOTION_FRAME_PAIRS + 1} live frames — keep your face in view and turn your head slowly.`,
    };
  }

  const pairs: GrayscaleMotionPair[] = [];
  for (let i = 1; i < grays.length; i++) {
    pairs.push(analyzeGrayscalePair(grays[i - 1], grays[i]));
  }

  const frameDiffs = pairs.map((p) => p.avgDiff);
  const avgDiff = frameDiffs.reduce((sum, v) => sum + v, 0) / frameDiffs.length;
  const motionScore = Math.min(1, avgDiff / 25);

  if (avgDiff < MIN_AVG_FRAME_DIFF) {
    return {
      passed: false,
      motionScore,
      frameDiffs,
      reason: "Live video required — static photos and phone screens are not accepted.",
    };
  }

  const centroidDrift = Math.abs(pairs[pairs.length - 1].centroidX - pairs[0].centroidX);
  if (centroidDrift < MIN_CENTROID_DRIFT) {
    return {
      passed: false,
      motionScore,
      frameDiffs,
      reason:
        "Turn your head slowly left and right. Holding a still photo or only shaking the phone is not accepted.",
    };
  }

  const asymmetricFrames = pairs.filter((p) => p.asymmetry >= MIN_ASYMMETRY_RATIO).length;
  if (asymmetricFrames < MIN_ASYMMETRIC_FRAME_COUNT) {
    return {
      passed: false,
      motionScore,
      frameDiffs,
      reason:
        "Turn your head left, then right — side-to-side face movement is required. A static photo will not pass.",
    };
  }

  const allUniform = pairs.every((p) => p.asymmetry <= MAX_UNIFORM_ASYMMETRY);
  if (allUniform) {
    return {
      passed: false,
      motionScore,
      frameDiffs,
      reason:
        "Uniform camera shake detected. Slowly turn your head instead of moving the phone at a photo.",
    };
  }

  const maxCenterRatio = Math.max(...pairs.map((p) => p.centerRatio));
  if (maxCenterRatio < MIN_CENTER_MOTION_RATIO) {
    return {
      passed: false,
      motionScore,
      frameDiffs,
      reason: "Keep your face centered in the frame and turn your head slowly left and right.",
    };
  }

  const diffCv = coefficientOfVariation(frameDiffs);
  if (diffCv < MIN_DIFF_COEFFICIENT_OF_VARIATION) {
    return {
      passed: false,
      motionScore,
      frameDiffs,
      reason:
        "Motion pattern looks artificial. Turn your head naturally left and right while facing the camera.",
    };
  }

  return { passed: true, motionScore, frameDiffs };
}
