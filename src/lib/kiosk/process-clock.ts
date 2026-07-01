import { createAdminClient } from "@/lib/supabase/admin";
import { validateLivenessFrames } from "@/lib/face/liveness";
import { matchAgainstEmbeddings } from "@/lib/kiosk/face-match";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";
import type { KioskSessionContext } from "@/lib/kiosk/session";

export type ClockAttemptType = "check_in" | "check_out";

export interface ProcessClockInput {
  session: KioskSessionContext;
  staffId: string;
  attemptType: ClockAttemptType;
  frameDescriptors: number[][];
  liveDescriptor: number[];
  livenessClipUrl?: string;
  liveCaptureUrl?: string;
  frameMetadata?: Record<string, unknown>;
}

export interface ProcessClockResult {
  success: boolean;
  status: "clocked" | "review" | "rejected";
  message: string;
  recordId?: string;
  reviewId?: string;
  matchDistance?: number;
  confidenceScore?: number;
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
    confidence_score: typeof extra.confidenceScore === "number" ? extra.confidenceScore : null,
    best_match_distance: typeof extra.bestDistance === "number" ? extra.bestDistance : null,
    metadata: extra,
  });
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

export async function processKioskClock(input: ProcessClockInput): Promise<ProcessClockResult> {
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, is_active, organization_id")
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

  const { data: org } = await admin
    .from("organizations")
    .select("face_match_max_distance, clock_attempt_cooldown_seconds")
    .eq("id", input.session.organizationId)
    .single();

  const maxDistance = org?.face_match_max_distance ?? 0.6;
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

  const lastType = await getLastAcceptedType(input.staffId);
  if (lastType === input.attemptType) {
    await logAttempt(input, "duplicate");
    return {
      success: false,
      status: "rejected",
      message:
        input.attemptType === "check_in"
          ? "Already checked in. Check out first."
          : "Already checked out. Check in first.",
    };
  }

  const liveness = validateLivenessFrames(input.frameDescriptors);
  if (!liveness.passed) {
    const { data: review } = await admin
      .from("review_queue")
      .insert({
        organization_id: input.session.organizationId,
        staff_id: input.staffId,
        kiosk_device_id: input.session.kioskId,
        attempt_type: input.attemptType,
        reason: "liveness_fail",
        status: "pending",
        liveness_clip_url: input.livenessClipUrl,
        live_capture_url: input.liveCaptureUrl,
        frame_metadata: input.frameMetadata || {},
      })
      .select("id")
      .single();

    await logAttempt(input, "liveness_fail", { reason: liveness.reason });
    return {
      success: false,
      status: "review",
      message: liveness.reason || "Liveness verification failed.",
      reviewId: review?.id,
    };
  }

  if (!isValidFaceDescriptor(input.liveDescriptor)) {
    await logAttempt(input, "no_match");
    return { success: false, status: "rejected", message: "Could not extract a valid face signature." };
  }

  const { data: embeddings } = await admin
    .from("face_embeddings")
    .select("embedding_values, angle_label, reference_clip_url")
    .eq("staff_id", input.staffId)
    .eq("is_active", true);

  if (!embeddings?.length) {
    await logAttempt(input, "no_embeddings");
    return {
      success: false,
      status: "rejected",
      message: "No registered face on file. Register your face in the staff portal first.",
    };
  }

  const stored = embeddings.map((row) => row.embedding_values as number[]);
  const match = matchAgainstEmbeddings(input.liveDescriptor, stored, maxDistance);

  if (!match.matched) {
    const reason = match.comparedCount === 0 ? "no_match" : "low_confidence";
    const ref = embeddings.find((e) => e.angle_label === "front")?.reference_clip_url
      || embeddings[0]?.reference_clip_url;

    const { data: review } = await admin
      .from("review_queue")
      .insert({
        organization_id: input.session.organizationId,
        staff_id: input.staffId,
        kiosk_device_id: input.session.kioskId,
        attempt_type: input.attemptType,
        reason,
        status: "pending",
        confidence_score: match.confidenceScore,
        best_match_distance: match.bestDistance,
        liveness_clip_url: input.livenessClipUrl,
        live_capture_url: input.liveCaptureUrl,
        stored_reference_url: ref,
        frame_metadata: input.frameMetadata || {},
      })
      .select("id")
      .single();

    await logAttempt(input, reason, {
      bestDistance: match.bestDistance,
      confidenceScore: match.confidenceScore,
    });

    return {
      success: false,
      status: "review",
      message: "Face match needs manual review.",
      reviewId: review?.id,
      matchDistance: match.bestDistance,
      confidenceScore: match.confidenceScore,
    };
  }

  const { data: record, error } = await admin
    .from("attendance_records")
    .insert({
      organization_id: input.session.organizationId,
      staff_id: input.staffId,
      type: input.attemptType,
      confidence_score: match.confidenceScore,
      best_match_distance: match.bestDistance,
      match_status: "auto_matched",
      liveness_passed: true,
      liveness_score: liveness.motionScore,
      liveness_clip_url: input.livenessClipUrl,
      kiosk_device_id: input.session.kioskId,
    })
    .select("id, server_timestamp")
    .single();

  if (error) {
    if (error.message.includes("duplicate_")) {
      await logAttempt(input, "duplicate", { bestDistance: match.bestDistance });
      return { success: false, status: "rejected", message: error.message };
    }
    throw new Error(error.message);
  }

  await logAttempt(input, "success", {
    recordId: record.id,
    bestDistance: match.bestDistance,
    confidenceScore: match.confidenceScore,
  });

  return {
    success: true,
    status: "clocked",
    message:
      input.attemptType === "check_in"
        ? `Checked in successfully.`
        : `Checked out successfully.`,
    recordId: record.id,
    matchDistance: match.bestDistance,
    confidenceScore: match.confidenceScore,
  };
}

export async function resolveReviewQueueItem(
  reviewId: string,
  adminProfileId: string,
  decision: "approved" | "rejected"
) {
  const admin = createAdminClient();
  const { data: review } = await admin
    .from("review_queue")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review || review.status !== "pending") {
    return { error: "Review item not found or already resolved." };
  }

  if (decision === "rejected") {
    await admin
      .from("review_queue")
      .update({
        status: "rejected",
        reviewed_by: adminProfileId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    await admin.from("clock_attempts").insert({
      organization_id: review.organization_id,
      kiosk_id: review.kiosk_device_id,
      staff_id: review.staff_id,
      attempt_type: review.attempt_type,
      outcome: "no_match",
      metadata: { reviewId, manual: true },
    });

    return { success: true, status: "rejected" as const };
  }

  const { data: record, error } = await admin
    .from("attendance_records")
    .insert({
      organization_id: review.organization_id,
      staff_id: review.staff_id,
      type: review.attempt_type,
      confidence_score: review.confidence_score,
      best_match_distance: review.best_match_distance,
      match_status: "manual_override",
      liveness_passed: review.reason !== "liveness_fail",
      liveness_score: null,
      liveness_clip_url: review.liveness_clip_url,
      kiosk_device_id: review.kiosk_device_id,
      reviewed_by: adminProfileId,
      review_queue_id: review.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await admin
    .from("review_queue")
    .update({
      status: "approved",
      reviewed_by: adminProfileId,
      reviewed_at: new Date().toISOString(),
      attendance_record_id: record.id,
    })
    .eq("id", reviewId);

  return { success: true, status: "approved" as const, recordId: record.id };
}
