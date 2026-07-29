import jpeg from "jpeg-js";
import { grayscaleFrameDiff } from "@/lib/face/pixel-motion";
import {
  MIN_PIXEL_MOTION_FRAMES,
  validatePixelMotionSamples,
} from "@/lib/face/liveness";

const SAMPLE_SIZE = 96;

function rgbaToGrayscaleSample(
  rgba: Uint8Array,
  srcW: number,
  srcH: number,
  size = SAMPLE_SIZE
): Uint8Array {
  const gray = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x / size) * srcW));
      const sy = Math.min(srcH - 1, Math.floor((y / size) * srcH));
      const i = (sy * srcW + sx) * 4;
      gray[y * size + x] =
        (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
    }
  }
  return gray;
}

function decodeJpegGrayscale(buffer: Buffer, size = SAMPLE_SIZE): Uint8Array | null {
  try {
    const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    if (!decoded.width || !decoded.height || decoded.data.length < 4) return null;
    return rgbaToGrayscaleSample(decoded.data, decoded.width, decoded.height, size);
  } catch {
    return null;
  }
}

/** Re-check motion from uploaded JPEG snapshots (independent of client motionScore). */
export function validateMotionFromJpegBuffers(buffers: Buffer[]) {
  const grays: Uint8Array[] = [];
  for (const buffer of buffers) {
    const gray = decodeJpegGrayscale(buffer);
    if (gray) grays.push(gray);
  }

  const frameDiffs: number[] = [];
  for (let i = 1; i < grays.length; i++) {
    frameDiffs.push(grayscaleFrameDiff(grays[i - 1], grays[i]));
  }

  return validatePixelMotionSamples(frameDiffs);
}

export function motionValidationErrorMessage(): string {
  return `Live video required — static photos and phone screens are not accepted. Record the live check and move your head slowly (${MIN_PIXEL_MOTION_FRAMES}+ frames with visible motion).`;
}
