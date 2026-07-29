import { createAdminClient } from "@/lib/supabase/admin";
import { verifyKioskPin } from "@/lib/kiosk/pin";
import {
  DiditValidationError,
  isDiditConfigured,
  validateDiditClockSession,
} from "@/lib/didit/client";
import type { KioskSessionContext } from "@/lib/kiosk/session";

export type ClockAttemptType = "check_in" | "check_out";

export interface ProcessClockInput {
  session: KioskSessionContext;
  staffId: string;
  attemptType: ClockAttemptType;
  pin: string;
  photoCaptureUrl?: string;
  diditSessionId?: string;
}

export interface ProcessClockResult {
  success: boolean;
  status: "clocked" | "rejected";
  message: string;
  recordId?: string;
}

async function logAttempt(
  input: ProcessClockInput,
  outcome: string,
  extra: Record<string, unknown> = {}
) {
  const admin = createAdminClient();
  await admin.from("clock_attempts").insert({
    organization_id: input.session.organizationId,
    kiosk_id: input.session.kioskId,
    staff_id: input.staffId,
    attempt_type: input.attemptType,
    outcome,
    metadata: extra,
  });
}

async function rejectClock(
  input: ProcessClockInput,
  outcome: string,
  message: string,
  extra: Record<string, unknown> = {}
): Promise<ProcessClockResult> {
  await logAttempt(input, outcome, extra);
  return { success: false, status: "rejected", message };
}

async function getLastAcceptedType(staffId: string): Promise<ClockAttemptType | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("attendance_records")
    .select("type")
    .eq("staff_id", staffId)
    .in("match_status", ["auto_matched", "manual_override"])
    .order("server_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.type as ClockAttemptType) || null;
}

async function hasSameDayAcceptedRecord(
  staffId: string,
  attemptType: ClockAttemptType
): Promise<boolean> {
  const admin = createAdminClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { data } = await admin
    .from("attendance_records")
    .select("id")
    .eq("staff_id", staffId)
    .eq("type", attemptType)
    .in("match_status", ["auto_matched", "manual_override"])
    .gte("server_timestamp", dayStart.toISOString())
    .lt("server_timestamp", dayEnd.toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function processKioskClock(input: ProcessClockInput): Promise<ProcessClockResult> {
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, is_active, organization_id, kiosk_pin_hash, avatar_url, face_enrolled_at")
    .eq("id", input.staffId)
    .maybeSingle();

  if (!staff?.is_active) {
    await logAttempt(input, "staff_inactive");
    return { success: false, status: "rejected", message: "Staff account is inactive." };
  }

  if (staff.organization_id !== input.session.organizationId) {
    await logAttempt(input, "session_invalid");
    return { success: false, status: "rejected", message: "Staff does not belong to this organization." };
  }

  if (!staff.face_enrolled_at) {
    await logAttempt(input, "liveness_fail", { reason: "kyc_not_complete" });
    return {
      success: false,
      status: "rejected",
      message: "Complete Didit KYC verification in the staff portal before clocking in.",
    };
  }

  if (!staff.kiosk_pin_hash) {
    await logAttempt(input, "invalid_pin");
    return {
      success: false,
      status: "rejected",
      message: "No kiosk PIN set. Ask your admin to configure one.",
    };
  }

  if (!verifyKioskPin(input.pin, staff.kiosk_pin_hash)) {
    await logAttempt(input, "invalid_pin");
    return { success: false, status: "rejected", message: "Incorrect PIN." };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("clock_attempt_cooldown_seconds, biometric_provider")
    .eq("id", input.session.organizationId)
    .single();

  const cooldownSec = org?.clock_attempt_cooldown_seconds ?? 30;
  const cooldownSince = new Date(Date.now() - cooldownSec * 1000).toISOString();
  const { data: recentAttempts } = await admin
    .from("clock_attempts")
    .select("id")
    .eq("staff_id", input.staffId)
    .gte("created_at", cooldownSince)
    .limit(1);

  if (recentAttempts && recentAttempts.length > 0) {
    await logAttempt(input, "rate_limited");
    return {
      success: false,
      status: "rejected",
      message: `Please wait ${cooldownSec} seconds before trying again.`,
    };
  }

  const sameDayDuplicate = await hasSameDayAcceptedRecord(input.staffId, input.attemptType);
  if (sameDayDuplicate) {
    return rejectClock(input, "duplicate_day", "Already clocked this action today.");
  }

  const lastType = await getLastAcceptedType(input.staffId);
  if (lastType === input.attemptType) {
    return rejectClock(input, "duplicate_day", "Already clocked for this action.", {
      consecutive: true,
    });
  }

  if (!isDiditConfigured()) {
    await logAttempt(input, "liveness_fail", { reason: "didit_not_configured" });
    return {
      success: false,
      status: "rejected",
      message: "Didit is not configured on the server.",
    };
  }

  if (!input.diditSessionId?.trim()) {
    await logAttempt(input, "liveness_fail", { reason: "missing_didit_session" });
    return {
      success: false,
      status: "rejected",
      message: "Didit verification is required. Complete Didit verification first.",
    };
  }

  let decision;
  try {
    decision = await validateDiditClockSession(input.staffId, input.diditSessionId);
  } catch (error) {
    const message =
      error instanceof DiditValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Didit verification failed.";
    const outcome =
      error instanceof DiditValidationError && error.message.includes("different staff")
        ? "no_match"
        : "liveness_fail";
    return rejectClock(input, outcome, message, {
      diditSessionId: input.diditSessionId,
    });
  }

  const { data: record, error } = await admin
    .from("attendance_records")
    .insert({
      organization_id: input.session.organizationId,
      staff_id: input.staffId,
      type: input.attemptType,
      match_status: "auto_matched",
      liveness_passed: true,
      liveness_score: decision.livenessScore ?? null,
      confidence_score: decision.faceMatchScore ?? null,
      photo_capture_url: input.photoCaptureUrl || null,
      kiosk_device_id: input.session.kioskId,
    })
    .select("id, server_timestamp")
    .single();

  if (error) {
    if (error.message.includes("duplicate_")) {
      return rejectClock(input, "duplicate_day", "Already clocked this action today.", {
        dbError: error.message,
      });
    }
    throw new Error(error.message);
  }

  await logAttempt(input, "success", {
    recordId: record.id,
    diditSessionId: input.diditSessionId,
    provider: "didit",
    faceMatchScore: decision.faceMatchScore,
    livenessScore: decision.livenessScore,
  });

  return {
    success: true,
    status: "clocked",
    message:
      input.attemptType === "check_in"
        ? "Didit verified. Checked in successfully."
        : "Didit verified. Checked out successfully.",
    recordId: record.id,
  };
}
