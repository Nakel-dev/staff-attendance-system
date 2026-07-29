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
  idVerificationApproved: boolean;
  livenessApproved: boolean;
  faceMatchApproved: boolean;
  hasFaceMatchChecks: boolean;
  faceMatchScore?: number;
  livenessScore?: number;
  raw?: Record<string, unknown>;
}

/** Create a Didit session. vendor_data must be the staff profile UUID. */
export async function createDiditSession(input: {
  staffId: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<DiditSessionCreateResult> {
  const res = await fetch(`${DIDIT_BASE}/session/`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflowId(),
      vendor_data: input.staffId,
      callback: input.callbackUrl,
      metadata: input.metadata,
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

/** @alias createDiditSession */
export const createKycSession = createDiditSession;

function featureApproved(
  items: unknown,
  scoreKey: "score" | "similarity_score" = "score"
): { approved: boolean; score?: number; present: boolean } {
  if (!Array.isArray(items) || items.length === 0) {
    return { approved: false, present: false };
  }
  const first = items[0] as Record<string, unknown>;
  const scoreRaw = first[scoreKey] ?? first.score;
  const score = typeof scoreRaw === "number" ? scoreRaw : undefined;
  const approved = items.every((item) => String((item as Record<string, unknown>).status) === "Approved");
  return { approved, score, present: true };
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
  const idVerification = featureApproved(body.id_verifications);
  const liveness = featureApproved(body.liveness_checks);
  const face = featureApproved(body.face_matches);

  return {
    sessionId,
    status,
    idVerificationApproved: idVerification.present ? idVerification.approved : status === "Approved",
    livenessApproved: liveness.present ? liveness.approved : status === "Approved",
    faceMatchApproved: face.present ? face.approved : true,
    hasFaceMatchChecks: face.present,
    faceMatchScore: face.score,
    livenessScore: liveness.score,
    raw: body,
  };
}

/** Portal enrollment: full KYC (ID + liveness + optional face match). */
export function isKycEnrollmentApproved(decision: DiditDecisionResult): boolean {
  if (decision.status !== "Approved") return false;
  if (!decision.idVerificationApproved) return false;
  if (!decision.livenessApproved) return false;
  if (decision.hasFaceMatchChecks && !decision.faceMatchApproved) return false;
  return true;
}

/** Kiosk / phone clock: liveness (+ face match if workflow includes it). ID not re-required. */
export function isDiditClockApproved(decision: DiditDecisionResult): boolean {
  if (decision.status !== "Approved") return false;
  if (!decision.livenessApproved) return false;
  if (decision.hasFaceMatchChecks && !decision.faceMatchApproved) return false;
  return true;
}

export function diditSessionMatchesStaff(decision: DiditDecisionResult, staffId: string): boolean {
  return String(decision.raw?.vendor_data || "") === staffId;
}

export function isTerminalDiditStatus(status: string): boolean {
  return ["Approved", "Declined", "In Review", "Expired", "Abandoned", "Kyc Expired"].includes(
    status
  );
}
