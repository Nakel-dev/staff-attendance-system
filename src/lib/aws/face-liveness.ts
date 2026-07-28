import {
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { awsRekognitionRegion, isAwsRekognitionConfigured } from "@/lib/aws/rekognition";

export function isAwsFaceLivenessConfigured(): boolean {
  return (
    isAwsRekognitionConfigured() &&
    Boolean(process.env.NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID?.trim())
  );
}

export function awsFaceLivenessConfidenceThreshold(): number {
  const raw = Number(process.env.AWS_FACE_LIVENESS_CONFIDENCE_THRESHOLD || 80);
  if (Number.isFinite(raw) && raw >= 50 && raw <= 99) return raw;
  return 80;
}

function getClient(): RekognitionClient {
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

export async function createFaceLivenessSession(): Promise<string> {
  const client = getClient();
  const result = await client.send(
    new CreateFaceLivenessSessionCommand({
      Settings: {
        AuditImagesLimit: 1,
      },
    })
  );
  if (!result.SessionId) {
    throw new Error("Could not start AWS Face Liveness session");
  }
  return result.SessionId;
}

export async function getFaceLivenessSessionResults(sessionId: string): Promise<{
  passed: boolean;
  confidence: number;
  referenceImageBytes: Uint8Array | null;
  status: string;
}> {
  const client = getClient();
  const threshold = awsFaceLivenessConfidenceThreshold();
  const result = await client.send(
    new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId })
  );

  const confidence = result.Confidence ?? 0;
  const bytes = result.ReferenceImage?.Bytes;

  return {
    passed: result.Status === "SUCCEEDED" && confidence >= threshold,
    confidence,
    referenceImageBytes: bytes ? new Uint8Array(bytes) : null,
    status: result.Status || "UNKNOWN",
  };
}
