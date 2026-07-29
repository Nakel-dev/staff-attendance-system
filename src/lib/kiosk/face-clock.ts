import { createAdminClient } from "@/lib/supabase/admin";
import type { KioskSessionContext } from "@/lib/kiosk/session";
import type { ClockAttemptType, ProcessClockResult } from "@/lib/kiosk/process-clock";
import {
  diditSessionMatchesStaff,
  getDiditSessionDecision,
  isDiditClockApproved,
  isDiditConfigured,
} from "@/lib/didit/client";

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

export async function suggestAttemptType(staffId: string): Promise<ClockAttemptType> {
  const last = await getLastAcceptedType(staffId);
  return last === "check_in" ? "check_out" : "check_in";
}

/** Kiosk clock after Didit verification on every check-in/out. */
export async function processKioskDiditClock(input: {
  session: KioskSessionContext;
  staffId: string;
  attemptType: ClockAttemptType;
  diditSessionId: string;
}): Promise<ProcessClockResult & { provider?: "didit" }> {
  if (!isDiditConfigured()) {
    return { success: false, status: "rejected", message: "Didit is not configured." };
  }

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("profiles")
    .select("id, is_active, organization_id, face_enrolled_at")
    .eq("id", input.staffId)
    .maybeSingle();

  if (!staff?.is_active || staff.organization_id !== input.session.organizationId) {
    return { success: false, status: "rejected", message: "Staff not found." };
  }

  if (!staff.face_enrolled_at) {
    return {
      success: false,
      status: "rejected",
      message: "Complete Didit KYC in the staff portal first.",
    };
  }

  const decision = await getDiditSessionDecision(input.diditSessionId);

  if (!diditSessionMatchesStaff(decision, input.staffId)) {
    return {
      success: false,
      status: "rejected",
      message: "Didit verification does not match this staff member.",
    };
  }

  if (!isDiditClockApproved(decision)) {
    return {
      success: false,
      status: "rejected",
      message: `Didit verification not approved (${decision.status}).`,
    };
  }

  const lastType = await getLastAcceptedType(staff.id);
  if (lastType === input.attemptType) {
    return {
      success: false,
      status: "rejected",
      message: "Already clocked for this action.",
    };
  }

  const { data: record, error } = await admin
    .from("attendance_records")
    .insert({
      organization_id: input.session.organizationId,
      staff_id: staff.id,
      type: input.attemptType,
      match_status: "auto_matched",
      liveness_passed: true,
      liveness_score: decision.livenessScore ?? null,
      confidence_score: decision.faceMatchScore ?? null,
      kiosk_device_id: input.session.kioskId,
    })
    .select("id")
    .single();

  if (error) {
    return {
      success: false,
      status: "rejected",
      message: error.message.includes("duplicate") ? "Already clocked today." : error.message,
    };
  }

  await admin.from("clock_attempts").insert({
    organization_id: input.session.organizationId,
    kiosk_id: input.session.kioskId,
    staff_id: staff.id,
    attempt_type: input.attemptType,
    outcome: "success",
    metadata: { provider: "didit", diditSessionId: input.diditSessionId, recordId: record.id },
  });

  const verb = input.attemptType === "check_in" ? "Checked in" : "Checked out";
  return {
    success: true,
    status: "clocked",
    provider: "didit",
    recordId: record.id,
    message: `${verb} via Didit verification.`,
  };
}
