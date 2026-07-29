import { createAdminClient } from "@/lib/supabase/admin";
import { verifyKioskPin } from "@/lib/kiosk/pin";
import { randomBytes } from "crypto";
import type { KioskSessionContext } from "@/lib/kiosk/session";
import type { ClockAttemptType } from "@/lib/kiosk/process-clock";
import { normalizeBiometricProvider } from "@/lib/biometrics/providers";
import {
  DiditValidationError,
  isDiditConfigured,
  validateDiditClockSession,
} from "@/lib/didit/client";

export const PHONE_CLOCK_TTL_SECONDS = 60;

function appBaseUrl(requestUrl?: string): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  if (requestUrl) return new URL(requestUrl).origin;
  return "http://localhost:3000";
}

export async function createPhoneClockChallenge(input: {
  session: KioskSessionContext;
  staffId: string;
  attemptType: ClockAttemptType;
  pin: string;
  requestUrl?: string;
}): Promise<
  | { error: string; status?: number }
  | { token: string; expiresAt: string; qrUrl: string; staffName: string; ttlSeconds: number }
> {
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, is_active, organization_id, kiosk_pin_hash, avatar_url, face_enrolled_at")
    .eq("id", input.staffId)
    .maybeSingle();

  if (!staff?.is_active || staff.organization_id !== input.session.organizationId) {
    return { error: "Staff not found", status: 404 };
  }
  if (!staff.kiosk_pin_hash || !verifyKioskPin(input.pin, staff.kiosk_pin_hash)) {
    return { error: "Incorrect PIN", status: 401 };
  }
  if (!staff.face_enrolled_at) {
    return {
      error: "Complete Didit KYC verification in the staff portal before using the kiosk.",
      status: 422,
    };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + PHONE_CLOCK_TTL_SECONDS * 1000).toISOString();

  const { error } = await admin.from("phone_clock_challenges").insert({
    token,
    organization_id: input.session.organizationId,
    kiosk_id: input.session.kioskId,
    staff_id: staff.id,
    attempt_type: input.attemptType,
    expires_at: expiresAt,
    status: "pending",
  });

  if (error) {
    // Table may not exist yet
    if (/phone_clock_challenges|does not exist|schema cache/i.test(error.message)) {
      return {
        error:
          "Phone clock QR is not set up yet. Run migration 014_phone_clock_challenges.sql in Supabase.",
        status: 503,
      };
    }
    return { error: error.message, status: 500 };
  }

  const qrUrl = `${appBaseUrl(input.requestUrl)}/clock/${token}`;
  return {
    token,
    expiresAt,
    qrUrl,
    staffName: staff.full_name,
    ttlSeconds: PHONE_CLOCK_TTL_SECONDS,
  };
}

export async function getPhoneChallengePublic(token: string) {
  const admin = createAdminClient();
  const { data: challenge, error } = await admin
    .from("phone_clock_challenges")
    .select(
      "id, token, staff_id, attempt_type, expires_at, status, organization_id, kiosk_id, completed_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !challenge) return { error: "Invalid or unknown QR code", status: 404 as const };

  const now = Date.now();
  const expired = new Date(challenge.expires_at).getTime() <= now;
  if (expired && challenge.status === "pending") {
    await admin
      .from("phone_clock_challenges")
      .update({ status: "expired" })
      .eq("id", challenge.id)
      .eq("status", "pending");
    challenge.status = "expired";
  }

  const { data: staff } = await admin
    .from("profiles")
    .select("full_name, avatar_url, face_enrolled_at")
    .eq("id", challenge.staff_id)
    .single();

  const { data: org } = await admin
    .from("organizations")
    .select("name, biometric_provider")
    .eq("id", challenge.organization_id)
    .single();

  const { data: kiosk } = await admin
    .from("kiosks")
    .select("device_name, location")
    .eq("id", challenge.kiosk_id)
    .single();

  const provider = normalizeBiometricProvider(org?.biometric_provider);

  return {
    challenge: {
      status: challenge.status as string,
      attemptType: challenge.attempt_type as ClockAttemptType,
      expiresAt: challenge.expires_at as string,
      secondsLeft: Math.max(
        0,
        Math.floor((new Date(challenge.expires_at).getTime() - now) / 1000)
      ),
      staffName: staff?.full_name || "Staff",
      hasAvatar: !!staff?.avatar_url,
      faceEnrolled: !!staff?.face_enrolled_at,
      organizationName: org?.name || "Organization",
      kioskName: kiosk?.device_name || "Reception kiosk",
      provider,
      providerReady: isDiditConfigured() && !!staff?.face_enrolled_at,
    },
  };
}

export async function getPhoneChallengeStatusForKiosk(token: string, kioskId: string) {
  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("phone_clock_challenges")
    .select("status, expires_at, failure_reason, attempt_type")
    .eq("token", token)
    .eq("kiosk_id", kioskId)
    .maybeSingle();

  if (!challenge) return { error: "Challenge not found" as const, status: 404 as const };

  if (
    challenge.status === "pending" &&
    new Date(challenge.expires_at).getTime() <= Date.now()
  ) {
    await admin
      .from("phone_clock_challenges")
      .update({ status: "expired" })
      .eq("token", token)
      .eq("status", "pending");
    return { status: "expired", message: "QR expired. Generate a new one." };
  }

  return {
    status: challenge.status as string,
    attemptType: challenge.attempt_type as string,
    message:
      challenge.status === "completed"
        ? "Phone verification complete"
        : challenge.status === "failed"
          ? challenge.failure_reason || "Verification failed"
          : challenge.status === "expired"
            ? "QR expired"
            : "Waiting for phone…",
  };
}

export async function completePhoneClockChallenge(input: {
  token: string;
  photoBytes?: Uint8Array;
  faceDescriptor?: number[];
  diditSessionId?: string;
  motionFrameBuffers?: Buffer[];
  livenessSessionId?: string;
}): Promise<{ success: boolean; message: string; status?: string }> {
  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("phone_clock_challenges")
    .select("*")
    .eq("token", input.token)
    .maybeSingle();

  if (!challenge) return { success: false, message: "Invalid QR code", status: "rejected" };

  if (challenge.status === "completed") {
    return { success: true, message: "Already completed", status: "clocked" };
  }

  if (challenge.status !== "pending") {
    return { success: false, message: `This QR is ${challenge.status}`, status: "rejected" };
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await admin
      .from("phone_clock_challenges")
      .update({ status: "expired" })
      .eq("id", challenge.id);
    return { success: false, message: "QR expired. Go back to the kiosk for a new code.", status: "expired" };
  }

  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, is_active, avatar_url, organization_id, face_enrolled_at")
    .eq("id", challenge.staff_id)
    .single();

  if (!staff?.is_active || !staff.face_enrolled_at) {
    await failChallenge(challenge.id, "Staff profile or KYC verification missing");
    return {
      success: false,
      message: "Complete Didit KYC verification in the staff portal first.",
      status: "rejected",
    };
  }

  if (!isDiditConfigured()) {
    await failChallenge(challenge.id, "Didit not configured");
    return { success: false, message: "Didit is not configured on the server." };
  }

  if (!input.diditSessionId?.trim()) {
    return { success: false, message: "Complete Didit verification on your phone first." };
  }

  let decision;
  try {
    decision = await validateDiditClockSession(challenge.staff_id, input.diditSessionId);
  } catch (error) {
    const message =
      error instanceof DiditValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Didit verification failed.";
    await failChallenge(challenge.id, message);
    return { success: false, message };
  }

  const confidence = decision.faceMatchScore ?? null;
  const livenessPassed = true;
  const photoPath: string | null = null;

  const { data: record, error: insertError } = await admin
    .from("attendance_records")
    .insert({
      organization_id: challenge.organization_id,
      staff_id: challenge.staff_id,
      type: challenge.attempt_type,
      match_status: "auto_matched",
      liveness_passed: livenessPassed,
      confidence_score: confidence,
      photo_capture_url: photoPath,
      kiosk_device_id: challenge.kiosk_id,
    })
    .select("id")
    .single();

  if (insertError) {
    await failChallenge(challenge.id, insertError.message);
    return {
      success: false,
      message: insertError.message.includes("duplicate")
        ? "Already clocked for this action today."
        : insertError.message,
    };
  }

  await admin
    .from("phone_clock_challenges")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      attendance_record_id: record.id,
    })
    .eq("id", challenge.id)
    .eq("status", "pending");

  await admin.from("clock_attempts").insert({
    organization_id: challenge.organization_id,
    staff_id: challenge.staff_id,
    kiosk_id: challenge.kiosk_id,
    attempt_type: challenge.attempt_type,
    outcome: "success",
    metadata: {
      channel: "phone_qr",
      provider: "didit",
      diditSessionId: input.diditSessionId,
      confidence,
    },
  });

  return {
    success: true,
    status: "clocked",
    message:
      challenge.attempt_type === "check_in"
        ? "Checked in successfully from your phone."
        : "Checked out successfully from your phone.",
  };
}

async function failChallenge(id: string, reason: string) {
  const admin = createAdminClient();
  await admin
    .from("phone_clock_challenges")
    .update({ status: "failed", failure_reason: reason, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
}
