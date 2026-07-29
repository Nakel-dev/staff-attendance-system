import {
  MAX_MOTION_FRAME_UPLOADS,
  MIN_PIXEL_MOTION_FRAMES,
} from "@/lib/face/liveness";
import {
  motionValidationErrorMessage,
  validateMotionFromJpegBuffers,
} from "@/lib/face/server-pixel-motion";

export const MOTION_FRAME_PREFIX = "motionFrame";

export function appendMotionFrames(form: FormData, frames: Blob[]) {
  const capped = frames.slice(0, MAX_MOTION_FRAME_UPLOADS);
  capped.forEach((frame, index) => {
    form.append(`${MOTION_FRAME_PREFIX}${index}`, frame, `frame${index}.jpg`);
  });
  form.append("motionFrameCount", String(capped.length));
}

export async function readMotionFrameBuffers(form: FormData): Promise<Buffer[]> {
  const countRaw = form.get("motionFrameCount");
  const count = countRaw != null ? Number(countRaw) : 0;
  if (!Number.isFinite(count) || count < 1) return [];

  const limit = Math.min(count, MAX_MOTION_FRAME_UPLOADS);
  const buffers: Buffer[] = [];
  for (let i = 0; i < limit; i++) {
    const file = form.get(`${MOTION_FRAME_PREFIX}${i}`);
    if (file instanceof File && file.size > 200) {
      buffers.push(Buffer.from(await file.arrayBuffer()));
    }
  }
  return buffers;
}

/** Server-side motion gate — ignores client-supplied motionScore. */
export async function requireServerMotionValidation(form: FormData): Promise<
  | { ok: true; motionScore: number }
  | { ok: false; message: string }
> {
  const buffers = await readMotionFrameBuffers(form);
  if (buffers.length < MIN_PIXEL_MOTION_FRAMES) {
    return { ok: false, message: motionValidationErrorMessage() };
  }

  const result = validateMotionFromJpegBuffers(buffers);
  if (!result.passed) {
    return { ok: false, message: result.reason || motionValidationErrorMessage() };
  }

  return { ok: true, motionScore: result.motionScore };
}
