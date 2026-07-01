import { createAdminClient } from "@/lib/supabase/admin";
import { verifyKioskPin } from "@/lib/kiosk/pin";
import type { KioskSessionContext } from "@/lib/kiosk/session";

export type ClockAttemptType = "check_in" | "check_out";

export type ReviewReason =
  | "missing_photo"
  | "duplicate_day"
  | "photo_review"
  | "low_confidence"
  | "no_match"
  | "liveness_fail";

export interface ProcessClockInput {
  session: KioskSessionContext;
  staffId: string;
  attemptType: ClockAttemptType;
  pin: string;
  photoCaptureUrl?: string;
}

export interface ProcessClockResult {
  success: boolean;
  status: "clocked" | "review" | "rejected";
  message: string;
  recordId?: string;
  reviewId?: string;
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

async function enqueueReview(
  input: ProcessClockInput,
  reason: ReviewReason,
  staff: { avatar_url?: string | null },
  extra: Record<string, unknown> = {}
) {
  const admin = createAdminClient();
  const { data: review } = await admin
    .from("review_queue")
    .insert({
      organization_id: input.session.organizationId,
      staff_id: input.staffId,
      kiosk_device_id: input.session.kioskId,
      attempt_type: input.attemptType,
      reason,
      status: "pending",
      live_capture_url: input.photoCaptureUrl || null,
      stored_reference_url: staff.avatar_url || null,
      frame_metadata: extra,
    })
    .select("id")
    .single();

  await logAttempt(input, reason, { reviewId: review?.id, ...extra });

  const messages: Record<ReviewReason, string> = {
    missing_photo: "No photo captured. Sent for admin review.",
    duplicate_day: "Already clocked this action today. Sent for admin review.",
    photo_review: "No profile photo on file. Sent for admin review.",
    low_confidence: "Needs manual review.",
    no_match: "Needs manual review.",
    liveness_fail: "Needs manual review.",
  };

  return {
    success: false as const,
    status: "review" as const,
    message: messages[reason],
    reviewId: review?.id,
  };
}

export async function processKioskClock(input: ProcessClockInput): Promise<ProcessClockResult> {
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, is_active, organization_id, kiosk_pin_hash, avatar_url")
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
    .select("clock_attempt_cooldown_seconds")
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

  if (!input.photoCaptureUrl?.trim()) {
    return enqueueReview(input, "missing_photo", staff);
  }

  const sameDayDuplicate = await hasSameDayAcceptedRecord(input.staffId, input.attemptType);
  if (sameDayDuplicate) {
    return enqueueReview(input, "duplicate_day", staff);
  }

  const lastType = await getLastAcceptedType(input.staffId);
  if (lastType === input.attemptType) {
    return enqueueReview(input, "duplicate_day", staff, { consecutive: true });
  }

  if (!staff.avatar_url) {
    return enqueueReview(input, "photo_review", staff);
  }

  const { data: record, error } = await admin
    .from("attendance_records")
    .insert({
      organization_id: input.session.organizationId,
      staff_id: input.staffId,
      type: input.attemptType,
      match_status: "auto_matched",
      liveness_passed: true,
      photo_capture_url: input.photoCaptureUrl,
      kiosk_device_id: input.session.kioskId,
    })
    .select("id, server_timestamp")
    .single();

  if (error) {
    if (error.message.includes("duplicate_")) {
      return enqueueReview(input, "duplicate_day", staff, { dbError: error.message });
    }
    throw new Error(error.message);
  }

  await logAttempt(input, "success", { recordId: record.id });

  return {
    success: true,
    status: "clocked",
    message:
      input.attemptType === "check_in"
        ? "Checked in successfully."
        : "Checked out successfully.",
    recordId: record.id,
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
      match_status: "manual_override",
      liveness_passed: true,
      photo_capture_url: review.live_capture_url,
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
