import {
  CompareFacesCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { createAdminClient } from "@/lib/supabase/admin";

export function awsRekognitionRegion(): string {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

export function isAwsRekognitionConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION)
  );
}

function getClient() {
  if (!isAwsRekognitionConfigured()) {
    throw new Error("AWS Rekognition is not configured");
  }
  return new RekognitionClient({
    region: awsRekognitionRegion(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function similarityThreshold(): number {
  const raw = Number(process.env.AWS_REKOGNITION_SIMILARITY_THRESHOLD || 90);
  if (Number.isFinite(raw) && raw >= 50 && raw <= 99) return raw;
  return 90;
}

/** Minimal valid JPEG (1×1) — used only to test IAM/API access. */
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

/**
 * Confirms credentials + rekognition:CompareFaces without needing a real face photo.
 * InvalidImageFormat / no faces in image still means auth succeeded.
 */
export async function verifyAwsRekognitionAccess(): Promise<{
  ok: boolean;
  region: string;
  similarityThreshold: number;
  message: string;
}> {
  const region = awsRekognitionRegion();
  const threshold = similarityThreshold();

  if (!isAwsRekognitionConfigured()) {
    return {
      ok: false,
      region,
      similarityThreshold: threshold,
      message:
        "Missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_REGION in environment.",
    };
  }

  try {
    const client = getClient();
    await client.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: TEST_JPEG },
        TargetImage: { Bytes: TEST_JPEG },
        SimilarityThreshold: threshold,
      })
    );
    return {
      ok: true,
      region,
      similarityThreshold: threshold,
      message: "AWS Rekognition CompareFaces is reachable with current credentials.",
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const msg = error instanceof Error ? error.message : String(error);

    if (
      name === "InvalidParameterException" ||
      name === "InvalidImageFormatException" ||
      /no faces/i.test(msg) ||
      /invalid/i.test(msg)
    ) {
      return {
        ok: true,
        region,
        similarityThreshold: threshold,
        message: "AWS credentials and CompareFaces permission OK (test image has no face, as expected).",
      };
    }

    if (name === "AccessDeniedException" || /access denied/i.test(msg)) {
      return {
        ok: false,
        region,
        similarityThreshold: threshold,
        message:
          "Access denied. Attach rekognition:CompareFaces to the IAM user (see docs/aws-rekognition-iam-policy.json).",
      };
    }

    return {
      ok: false,
      region,
      similarityThreshold: threshold,
      message: msg || "AWS Rekognition check failed",
    };
  }
}

async function downloadStorageBytes(bucket: string, path: string): Promise<Uint8Array> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Could not load image from storage (${bucket}/${path})`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function compareFacesAws(input: {
  sourceAvatarPath: string;
  targetImageBytes: Uint8Array;
}): Promise<{ matched: boolean; similarity: number }> {
  const source = await downloadStorageBytes("profile-photos", input.sourceAvatarPath);
  const client = getClient();
  const result = await client.send(
    new CompareFacesCommand({
      SourceImage: { Bytes: source },
      TargetImage: { Bytes: input.targetImageBytes },
      SimilarityThreshold: similarityThreshold(),
    })
  );

  const best = (result.FaceMatches || []).reduce((max, match) => {
    const score = match.Similarity ?? 0;
    return score > max ? score : max;
  }, 0);

  return {
    matched: best >= similarityThreshold(),
    similarity: best,
  };
}

export async function compareStoredPhotosAws(input: {
  sourceAvatarPath: string;
  targetCapturePath: string;
}): Promise<{ matched: boolean; similarity: number }> {
  const target = await downloadStorageBytes("kiosk-attendance-photos", input.targetCapturePath);
  return compareFacesAws({
    sourceAvatarPath: input.sourceAvatarPath,
    targetImageBytes: target,
  });
}
