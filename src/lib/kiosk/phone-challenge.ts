import { createAdminClient } from "@/lib/supabase/admin";
import { verifyKioskPin } from "@/lib/kiosk/pin";
import { randomBytes } from "crypto";
import type { KioskSessionContext } from "@/lib/kiosk/session";
import type { ClockAttemptType } from "@/lib/kiosk/process-clock";
import {
  compareFacesAws,
  isAwsRekognitionConfigured,
} from "@/lib/aws/rekognition";
import {
  getFaceLivenessSessionResults,
  isAwsFaceLivenessConfigured,
} from "@/lib/aws/face-liveness";
import { MIN_MOTION_SCORE } from "@/lib/face/liveness";
import {
  getDiditSessionDecision,
  isDiditConfigured,
} from "@/lib/didit/client";
import { normalizeBiometricProvider } from "@/lib/biometrics/providers";
import { matchAgainstEmbeddings } from "@/lib/kiosk/face-match";
import { FACE_MATCH_THRESHOLD, isValidFaceDescriptor } from "@/lib/utils/faceMatch";

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
  if (!staff.avatar_url || !staff.face_enrolled_at) {
    return {
      error:
        "Complete camera photo and face verification in the staff portal before using the kiosk.",
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
  const awsOk = isAwsRekognitionConfigured();
  const diditOk = isDiditConfigured();

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
      providerReady:
        provider === "aws" ? awsOk : provider === "didit" ? diditOk : true,
      awsLiveness: isAwsFaceLivenessConfigured(),
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
  motionScore?: number;
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

  if (!staff?.is_active || !staff.avatar_url || !staff.face_enrolled_at) {
    await failChallenge(challenge.id, "Staff profile, photo, or face enrollment missing");
    return {
      success: false,
      message: "Complete camera photo and face verification in the portal first.",
      status: "rejected",
    };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("biometric_provider")
    .eq("id", challenge.organization_id)
    .single();

  const provider = normalizeBiometricProvider(org?.biometric_provider);
  if (provider === "aws" && !isAwsRekognitionConfigured()) {
    await failChallenge(challenge.id, "AWS not configured on server");
    return {
      success: false,
      message:
        "AWS Rekognition is not configured on the server. Ask your admin to add AWS keys on Vercel.",
    };
  }
  if (provider === "didit" && !isDiditConfigured()) {
    await failChallenge(challenge.id, "Didit not configured");
    return { success: false, message: "Didit is not configured on the server." };
  }

  let confidence: number | null = null;
  let livenessPassed = true;
  let photoPath: string | null = null;

  if (provider === "didit") {
    if (!input.diditSessionId?.trim()) {
      return { success: false, message: "Complete Didit face check on your phone first." };
    }
    const decision = await getDiditSessionDecision(input.diditSessionId);
    if (String(decision.raw?.vendor_data || "") !== challenge.staff_id) {
      await failChallenge(challenge.id, "Didit staff mismatch");
      return { success: false, message: "Face verification does not match this staff member." };
    }
    if (!(decision.status === "Approved" && decision.livenessApproved && decision.faceMatchApproved)) {
      await failChallenge(challenge.id, `Didit ${decision.status}`);
      return {
        success: false,
        message: `Face verification not approved (${decision.status}). Try again.`,
      };
    }
    confidence = decision.faceMatchScore ?? null;
    livenessPassed = true;
  } else if (provider === "aws") {
    let targetBytes = input.photoBytes;

    if (input.livenessSessionId?.trim()) {
      const liveness = await getFaceLivenessSessionResults(input.livenessSessionId.trim());
      if (!liveness.passed) {
        await failChallenge(challenge.id, `AWS liveness ${liveness.confidence}`);
        return {
          success: false,
          message: `Live face check failed (${liveness.confidence.toFixed(0)}% confidence). Try again.`,
        };
      }
      if (!liveness.referenceImageBytes?.byteLength) {
        await failChallenge(challenge.id, "AWS liveness missing reference image");
        return { success: false, message: "Live face check failed. Try again." };
      }
      targetBytes = liveness.referenceImageBytes;
    } else {
      const motionScore = input.motionScore;
      if (!Number.isFinite(motionScore) || (motionScore as number) < MIN_MOTION_SCORE) {
        await failChallenge(challenge.id, "missing_motion_liveness");
        return {
          success: false,
          message:
            "Live video required — static photos and phone screens are not accepted. Record the 3-second live check.",
        };
      }
    }

    if (!targetBytes?.byteLength) {
      return { success: false, message: "Take a live selfie to continue." };
    }
    const comparison = await compareFacesAws({
      sourceAvatarPath: staff.avatar_url,
      targetImageBytes: targetBytes,
    });
    if (!comparison.matched) {
      await failChallenge(challenge.id, `AWS similarity ${comparison.similarity}`);
      return {
        success: false,
        message: `Face did not match your signup photo (${comparison.similarity.toFixed(0)}%). Try better lighting.`,
      };
    }
    confidence = comparison.similarity;
    photoPath = await storePhoneCapture(challenge.staff_id, targetBytes);
  } else {
    // local: match live face descriptor against signup enrollment embeddings
    if (!input.faceDescriptor || !isValidFaceDescriptor(input.faceDescriptor)) {
      return {
        success: false,
        message: "Take a live face capture so we can match it to your signup enrollment.",
      };
    }

    const { data: embeddings } = await admin
      .from("face_embeddings")
      .select("embedding_values")
      .eq("staff_id", challenge.staff_id)
      .eq("is_active", true);

    const stored: number[][] = (embeddings || [])
      .map((row) => row.embedding_values as number[])
      .filter((d) => Array.isArray(d) && d.length === 128);

    const { data: profileDesc } = await admin
      .from("profiles")
      .select("face_descriptor")
      .eq("id", challenge.staff_id)
      .single();

    if (Array.isArray(profileDesc?.face_descriptor) && profileDesc.face_descriptor.length === 128) {
      stored.push(profileDesc.face_descriptor as number[]);
    }

    if (stored.length === 0) {
      await failChallenge(challenge.id, "No enrollment embeddings");
      return {
        success: false,
        message: "No face enrollment found. Complete face verification in the portal again.",
      };
    }

    const match = matchAgainstEmbeddings(
      input.faceDescriptor,
      stored,
      FACE_MATCH_THRESHOLD
    );
    if (!match.matched) {
      await failChallenge(challenge.id, `local distance ${match.bestDistance}`);
      return {
        success: false,
        message:
          "Face did not match your signup enrollment. Try better lighting and look straight ahead.",
      };
    }
    confidence = Math.round(match.confidenceScore * 100);
    if (input.photoBytes?.byteLength) {
      photoPath = await storePhoneCapture(challenge.staff_id, input.photoBytes);
    }
    livenessPassed = true;
  }

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
    metadata: { channel: "phone_qr", provider, confidence },
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

async function storePhoneCapture(staffId: string, bytes: Uint8Array): Promise<string | null> {
  const admin = createAdminClient();
  const path = `${staffId}/phone-${Date.now()}.jpg`;
  const { error } = await admin.storage.from("kiosk-attendance-photos").upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return null;
  return path;
}
