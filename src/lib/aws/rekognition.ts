import {
  CompareFacesCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { createAdminClient } from "@/lib/supabase/admin";

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
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
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
