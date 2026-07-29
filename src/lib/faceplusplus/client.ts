/**
 * Face++ (Megvii) face compare — server-side only.
 * @see https://console.faceplusplus.com/documents/5677827
 */

const DEFAULT_BASE = "https://api-us.faceplusplus.com";

export function facePlusPlusBaseUrl(): string {
  return (process.env.FACEPP_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
}

export function isFacePlusPlusConfigured(): boolean {
  return Boolean(process.env.FACEPP_API_KEY?.trim() && process.env.FACEPP_API_SECRET?.trim());
}

export function facePlusPlusConfidenceThreshold(): number {
  const raw = Number(process.env.FACEPP_COMPARE_CONFIDENCE_THRESHOLD || 70);
  if (Number.isFinite(raw) && raw >= 40 && raw <= 99) return raw;
  return 70;
}

function toJpegBlob(bytes: Uint8Array): Blob {
  return new Blob([Buffer.from(bytes)], { type: "image/jpeg" });
}

type FacePlusPlusErrorBody = {
  error_message?: string;
  error?: string;
};

async function facePlusPlusRequest<T>(
  path: string,
  form: FormData
): Promise<T> {
  if (!isFacePlusPlusConfigured()) {
    throw new Error("Face++ is not configured (FACEPP_API_KEY / FACEPP_API_SECRET)");
  }

  form.append("api_key", process.env.FACEPP_API_KEY!.trim());
  form.append("api_secret", process.env.FACEPP_API_SECRET!.trim());

  const res = await fetch(`${facePlusPlusBaseUrl()}${path}`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as T & FacePlusPlusErrorBody;
  if (!res.ok) {
    throw new Error(body.error_message || body.error || `Face++ HTTP ${res.status}`);
  }
  if (body.error_message) {
    throw new Error(body.error_message);
  }

  return body;
}

export type FacePlusPlusDetectResult = {
  face_num: number;
  faces?: { face_token: string }[];
};

/** Detect faces (used for connectivity checks). */
export async function detectFacePlusPlus(imageBytes: Uint8Array): Promise<FacePlusPlusDetectResult> {
  const form = new FormData();
  form.append("image_file", toJpegBlob(imageBytes), "probe.jpg");
  return facePlusPlusRequest<FacePlusPlusDetectResult>("/facepp/v3/detect", form);
}

export type FacePlusPlusCompareResult = {
  confidence: number;
  thresholds?: Record<string, number>;
  face1?: { face_rectangle?: { width: number; height: number } };
  face2?: { face_rectangle?: { width: number; height: number } };
};

/** Compare profile photo vs kiosk snapshot. Returns confidence 0–100. */
export async function compareFacesFacePlusPlus(input: {
  referenceImageBytes: Uint8Array;
  liveImageBytes: Uint8Array;
}): Promise<{ matched: boolean; confidence: number; threshold: number }> {
  const form = new FormData();
  form.append("image_file1", toJpegBlob(input.referenceImageBytes), "reference.jpg");
  form.append("image_file2", toJpegBlob(input.liveImageBytes), "live.jpg");

  const result = await facePlusPlusRequest<FacePlusPlusCompareResult>("/facepp/v3/compare", form);
  const confidence = result.confidence ?? 0;
  const threshold = facePlusPlusConfidenceThreshold();
  const matched = confidence >= threshold;

  return { matched, confidence, threshold };
}

/** Ping Face++ API with a minimal JPEG (auth check). */
export async function verifyFacePlusPlusAccess(): Promise<{
  ok: boolean;
  baseUrl: string;
  threshold: number;
  message: string;
}> {
  const baseUrl = facePlusPlusBaseUrl();
  const threshold = facePlusPlusConfidenceThreshold();

  if (!isFacePlusPlusConfigured()) {
    return {
      ok: false,
      baseUrl,
      threshold,
      message: "Missing FACEPP_API_KEY or FACEPP_API_SECRET in environment.",
    };
  }

  const TEST_JPEG = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x80, 0xff, 0xd9,
  ]);

  try {
    const detect = await detectFacePlusPlus(TEST_JPEG);
    if (detect.face_num === 0) {
      return {
        ok: true,
        baseUrl,
        threshold,
        message: "Face++ API keys valid (detect OK — test image has no face, as expected).",
      };
    }
    return {
      ok: true,
      baseUrl,
      threshold,
      message: `Face++ API reachable. Detect returned ${detect.face_num} face(s).`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/AUTHENTICATION_ERROR|invalid api key|api_key/i.test(msg)) {
      return {
        ok: false,
        baseUrl,
        threshold,
        message: "Invalid Face++ API key or secret. Check console.faceplusplus.com.",
      };
    }
    return { ok: false, baseUrl, threshold, message: msg };
  }
}
