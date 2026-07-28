/**
 * Verify AWS Rekognition credentials + CompareFaces IAM (no Next.js imports).
 * Run: npm run verify:aws
 */
import dotenv from "dotenv";
import { CompareFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

dotenv.config({ path: ".env.local" });

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

function region(): string {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

function threshold(): number {
  const raw = Number(process.env.AWS_REKOGNITION_SIMILARITY_THRESHOLD || 90);
  if (Number.isFinite(raw) && raw >= 50 && raw <= 99) return raw;
  return 90;
}

function configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION)
  );
}

async function verify(): Promise<{ ok: boolean; message: string }> {
  const awsRegion = region();
  const similarityThreshold = threshold();

  if (!configured()) {
    return {
      ok: false,
      message:
        "Missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_REGION in .env.local (and Vercel for production).",
    };
  }

  const client = new RekognitionClient({
    region: awsRegion,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    await client.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: TEST_JPEG },
        TargetImage: { Bytes: TEST_JPEG },
        SimilarityThreshold: similarityThreshold,
      })
    );
    return { ok: true, message: "AWS Rekognition CompareFaces is reachable." };
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
        message: "AWS credentials and CompareFaces permission OK (test image has no face, as expected).",
      };
    }

    if (name === "AccessDeniedException" || /access denied/i.test(msg)) {
      return {
        ok: false,
        message:
          "Access denied. Attach rekognition:CompareFaces (see docs/aws-rekognition-iam-policy.json).",
      };
    }

    return { ok: false, message: msg || "AWS Rekognition check failed" };
  }
}

async function main() {
  console.log(`Region: ${region()}`);
  console.log(`Similarity threshold: ${threshold()}%`);
  console.log(`AWS_ACCESS_KEY_ID set: ${Boolean(process.env.AWS_ACCESS_KEY_ID)}`);

  const result = await verify();
  console.log(result.ok ? "OK:" : "FAIL:", result.message);

  if (!result.ok) {
    console.log("\nNext steps:");
    console.log("1. Create IAM user with docs/aws-rekognition-iam-policy.json");
    console.log("2. Set AWS_* vars in .env.local and Vercel, then redeploy");
    console.log("3. Run migration 015_default_aws_biometric.sql in Supabase");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
