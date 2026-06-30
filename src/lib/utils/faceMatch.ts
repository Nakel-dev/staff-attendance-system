export const FACE_DESCRIPTOR_LENGTH = 128;
export const FACE_MATCH_THRESHOLD = 0.55;

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function isValidFaceDescriptor(descriptor: unknown): descriptor is number[] {
  if (!Array.isArray(descriptor) || descriptor.length !== FACE_DESCRIPTOR_LENGTH) return false;
  return descriptor.every((value) => typeof value === "number" && Number.isFinite(value));
}

export function compareFaceDescriptors(
  enrolled: number[],
  live: number[]
): { distance: number; passed: boolean } {
  const distance = euclideanDistance(enrolled, live);
  return {
    distance,
    passed: distance <= FACE_MATCH_THRESHOLD,
  };
}
