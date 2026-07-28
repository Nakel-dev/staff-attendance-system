import { createAdminClient } from "@/lib/supabase/admin";

const DIDIT_BASE = "https://verification.didit.me/v3";

export function isDiditConfigured(): boolean {
  return Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID);
}

function apiKey(): string {
  const key = process.env.DIDIT_API_KEY;
  if (!key) throw new Error("DIDIT_API_KEY is not configured");
  return key;
}

function workflowId(): string {
  const id = process.env.DIDIT_WORKFLOW_ID;
  if (!id) throw new Error("DIDIT_WORKFLOW_ID is not configured");
  return id;
}

export interface DiditSessionCreateResult {
  sessionId: string;
  sessionUrl: string;
  status?: string;
}

export interface DiditDecisionResult {
  sessionId: string;
  status: string;
  livenessApproved: boolean;
  faceMatchApproved: boolean;
  faceMatchScore?: number;
  livenessScore?: number;
  raw?: Record<string, unknown>;
}

async function downloadProfilePhotoBase64(avatarPath: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("profile-photos").download(avatarPath);
  if (error || !data) {
    throw new Error("Could not load staff profile photo for face match.");
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.byteLength > 1_800_000) {
    throw new Error("Profile photo is too large for Didit (max ~1.8MB). Upload a smaller photo.");
  }
  return buffer.toString("base64");
}

export async function createBiometricAuthSession(input: {
  staffId: string;
  avatarPath: string;
  attemptType: "check_in" | "check_out";
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<DiditSessionCreateResult> {
  const portraitImage = await downloadProfilePhotoBase64(input.avatarPath);

  const res = await fetch(`${DIDIT_BASE}/session/`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflowId(),
      workflow_type: "biometric_authentication",
      vendor_data: input.staffId,
      callback: input.callbackUrl,
      metadata: {
        attempt_type: input.attemptType,
        source: "attendpro_kiosk",
        ...input.metadata,
      },
      portrait_image: portraitImage,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail =
      (typeof body.detail === "string" && body.detail) ||
      (typeof body.message === "string" && body.message) ||
      JSON.stringify(body);
    throw new Error(`Didit session create failed (${res.status}): ${detail}`);
  }

  const sessionId = String(body.session_id || body.id || "");
  const sessionUrl = String(body.session_url || body.url || "");
  if (!sessionId || !sessionUrl) {
    throw new Error("Didit did not return session_id/session_url");
  }

  return {
    sessionId,
    sessionUrl,
    status: typeof body.status === "string" ? body.status : undefined,
  };
}

function featureApproved(
  items: unknown,
  scoreKey: "score" | "similarity_score" = "score"
): { approved: boolean; score?: number } {
  if (!Array.isArray(items) || items.length === 0) {
    return { approved: false };
  }
  const first = items[0] as Record<string, unknown>;
  const status = String(first.status || "");
  const scoreRaw = first[scoreKey] ?? first.score;
  const score = typeof scoreRaw === "number" ? scoreRaw : undefined;
  return { approved: status === "Approved", score };
}

export async function getDiditSessionDecision(sessionId: string): Promise<DiditDecisionResult> {
  const res = await fetch(`${DIDIT_BASE}/session/${sessionId}/decision/`, {
    method: "GET",
    headers: { "x-api-key": apiKey() },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail =
      (typeof body.detail === "string" && body.detail) ||
      (typeof body.message === "string" && body.message) ||
      JSON.stringify(body);
    throw new Error(`Didit decision fetch failed (${res.status}): ${detail}`);
  }

  const status = String(body.status || "Unknown");
  const liveness = featureApproved(body.liveness_checks);
  const face = featureApproved(body.face_matches);

  return {
    sessionId,
    status,
    livenessApproved: liveness.approved,
    faceMatchApproved: face.approved,
    faceMatchScore: face.score,
    livenessScore: liveness.score,
    raw: body,
  };
}

export function isTerminalDiditStatus(status: string): boolean {
  return ["Approved", "Declined", "In Review", "Expired", "Abandoned", "Kyc Expired"].includes(
    status
  );
}
