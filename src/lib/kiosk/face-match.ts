import { euclideanDistance, isValidFaceDescriptor } from "@/lib/utils/faceMatch";

export interface FaceMatchResult {
  bestDistance: number;
  confidenceScore: number;
  matched: boolean;
  comparedCount: number;
}

export function matchAgainstEmbeddings(
  liveDescriptor: number[],
  storedEmbeddings: number[][],
  maxDistance: number
): FaceMatchResult {
  if (!isValidFaceDescriptor(liveDescriptor) || storedEmbeddings.length === 0) {
    return {
      bestDistance: Number.POSITIVE_INFINITY,
      confidenceScore: 0,
      matched: false,
      comparedCount: 0,
    };
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  for (const stored of storedEmbeddings) {
    if (!isValidFaceDescriptor(stored)) continue;
    bestDistance = Math.min(bestDistance, euclideanDistance(liveDescriptor, stored));
  }

  const confidenceScore =
    bestDistance === Number.POSITIVE_INFINITY
      ? 0
      : Math.max(0, Math.min(1, 1 - bestDistance / Math.max(maxDistance, 0.001)));

  return {
    bestDistance,
    confidenceScore,
    matched: bestDistance <= maxDistance,
    comparedCount: storedEmbeddings.length,
  };
}
