/**
 * Verify Face++ API credentials.
 * Run: npm run verify:facepp
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DEFAULT_BASE = "https://api-us.faceplusplus.com";

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

function baseUrl(): string {
  return (process.env.FACEPP_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
}

function threshold(): number {
  const raw = Number(process.env.FACEPP_COMPARE_CONFIDENCE_THRESHOLD || 70);
  return Number.isFinite(raw) && raw >= 40 && raw <= 99 ? raw : 70;
}

function configured(): boolean {
  return Boolean(process.env.FACEPP_API_KEY?.trim() && process.env.FACEPP_API_SECRET?.trim());
}

async function verify(): Promise<{ ok: boolean; message: string }> {
  if (!configured()) {
    return {
      ok: false,
      message: "Missing FACEPP_API_KEY or FACEPP_API_SECRET in .env.local",
    };
  }

  const form = new FormData();
  form.append("api_key", process.env.FACEPP_API_KEY!.trim());
  form.append("api_secret", process.env.FACEPP_API_SECRET!.trim());
  form.append("image_file", new Blob([TEST_JPEG], { type: "image/jpeg" }), "probe.jpg");

  const res = await fetch(`${baseUrl()}/facepp/v3/detect`, { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as {
    error_message?: string;
    face_num?: number;
  };

  if (body.error_message) {
    if (/AUTHENTICATION|api_key|api_secret/i.test(body.error_message)) {
      return { ok: false, message: `Invalid Face++ credentials: ${body.error_message}` };
    }
    if (/INVALID_IMAGE_SIZE|IMAGE_ERROR/i.test(body.error_message)) {
      return {
        ok: true,
        message: "Face++ API keys valid (detect reached API — probe image too small, as expected).",
      };
    }
    return { ok: false, message: body.error_message };
  }

  if (!res.ok) {
    return { ok: false, message: `Face++ HTTP ${res.status}` };
  }

  return {
    ok: true,
    message:
      body.face_num === 0
        ? "Face++ API keys valid (detect OK — test image has no face, as expected)."
        : `Face++ API reachable. Detect returned ${body.face_num} face(s).`,
  };
}

async function main() {
  console.log(`Base URL: ${baseUrl()}`);
  console.log(`Compare threshold: ${threshold()}%`);
  console.log(`FACEPP_API_KEY set: ${Boolean(process.env.FACEPP_API_KEY?.trim())}`);

  const result = await verify();
  console.log(result.ok ? "OK:" : "FAIL:", result.message);

  if (!result.ok) {
    console.log("\nNext steps — see FACEPP_SETUP.md");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
