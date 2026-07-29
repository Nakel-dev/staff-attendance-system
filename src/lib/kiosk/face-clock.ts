import { createAdminClient } from "@/lib/supabase/admin";
import type { KioskSessionContext } from "@/lib/kiosk/session";
import type { ClockAttemptType, ProcessClockResult } from "@/lib/kiosk/process-clock";
import { isFacePlusPlusConfigured, compareFacesFacePlusPlus } from "@/lib/faceplusplus/client";
import { isDiditConfigured } from "@/lib/didit/client";

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

async function resolveStaff(input: {
  organizationId: string;
  staffId?: string;
  employeeCode?: string;
}) {
  const admin = createAdminClient();
  if (input.staffId) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, is_active, organization_id, avatar_url, employee_code, face_enrolled_at")
      .eq("id", input.staffId)
      .maybeSingle();
    return data;
  }
  if (input.employeeCode?.trim()) {
    const code = input.employeeCode.trim().toUpperCase();
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, is_active, organization_id, avatar_url, employee_code, face_enrolled_at")
      .eq("organization_id", input.organizationId)
      .eq("employee_code", code)
      .maybeSingle();
    return data;
  }
  return null;
}

/** Kiosk clock: staff ID + video snapshot → Face++ auto-match (no admin review). Didit if Face++ off. */
export async function processKioskFaceClock(input: {
  session: KioskSessionContext;
  staffId?: string;
  employeeCode?: string;
  attemptType: ClockAttemptType;
  videoPath: string;
  snapshotPath: string;
}): Promise<
  ProcessClockResult & {
    provider?: "faceplusplus" | "didit";
    faceMatchConfidence?: number;
    needsDidit?: boolean;
  }
> {
  const admin = createAdminClient();
  const staff = await resolveStaff({
    organizationId: input.session.organizationId,
    staffId: input.staffId,
    employeeCode: input.employeeCode,
  });

  if (!staff?.is_active || staff.organization_id !== input.session.organizationId) {
    return { success: false, status: "rejected", message: "Staff not found. Check your staff ID." };
  }

  if (!staff.avatar_url) {
    return {
      success: false,
      status: "rejected",
      message: "No profile photo on file. Complete photo capture in the staff portal first.",
    };
  }

  if (!staff.face_enrolled_at) {
    return {
      success: false,
      status: "rejected",
      message:
        "Face verification not completed. Log in to the staff portal, upload your photo, and complete face verification before clocking in at the kiosk.",
    };
  }

  const lastType = await getLastAcceptedType(staff.id);
  if (lastType === input.attemptType) {
    return {
      success: false,
      status: "rejected",
      message:
        input.attemptType === "check_in"
          ? "You are already checked in. Select check out."
          : "You are already checked out. Select check in.",
    };
  }

  if (!isFacePlusPlusConfigured()) {
    if (isDiditConfigured()) {
      return {
        success: false,
        status: "rejected",
        needsDidit: true,
        provider: "didit",
        message: "Face++ is not configured. Use Didit face verification instead.",
      };
    }
    return {
      success: false,
      status: "rejected",
      message: "Face verification is not configured. Add FACEPP_API_KEY or Didit keys to .env.local.",
    };
  }

  try {
    const [profileDl, snapDl] = await Promise.all([
      admin.storage.from("profile-photos").download(staff.avatar_url),
      admin.storage.from("kiosk-attendance-photos").download(input.snapshotPath),
    ]);

    if (!profileDl.data || !snapDl.data) {
      return {
        success: false,
        status: "rejected",
        message: "Could not load photos for face verification.",
      };
    }

    const comparison = await compareFacesFacePlusPlus({
      referenceImageBytes: new Uint8Array(await profileDl.data.arrayBuffer()),
      liveImageBytes: new Uint8Array(await snapDl.data.arrayBuffer()),
    });

    if (!comparison.matched) {
      await admin.from("clock_attempts").insert({
        organization_id: input.session.organizationId,
        kiosk_id: input.session.kioskId,
        staff_id: staff.id,
        attempt_type: input.attemptType,
        outcome: "no_match",
        metadata: {
          provider: "faceplusplus",
          confidence: comparison.confidence,
          threshold: comparison.threshold,
        },
      });

      if (isDiditConfigured()) {
        return {
          success: false,
          status: "rejected",
          needsDidit: true,
          provider: "didit",
          faceMatchConfidence: comparison.confidence,
          message: `Face did not match (${comparison.confidence.toFixed(1)}%, need ${comparison.threshold}%). Try Didit verification or retake with better lighting.`,
        };
      }

      return {
        success: false,
        status: "rejected",
        faceMatchConfidence: comparison.confidence,
        message: `Face did not match your portal verification photo (${comparison.confidence.toFixed(1)}%). Try again with better lighting.`,
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
        confidence_score: comparison.confidence,
        liveness_clip_url: input.videoPath,
        photo_capture_url: input.snapshotPath,
        kiosk_device_id: input.session.kioskId,
      })
      .select("id")
      .single();

    if (error) {
      return {
        success: false,
        status: "rejected",
        message: error.message.includes("duplicate")
          ? "Already clocked for this action today."
          : error.message,
      };
    }

    await admin.from("clock_attempts").insert({
      organization_id: input.session.organizationId,
      kiosk_id: input.session.kioskId,
      staff_id: staff.id,
      attempt_type: input.attemptType,
      outcome: "success",
      metadata: {
        provider: "faceplusplus",
        confidence: comparison.confidence,
        recordId: record.id,
      },
    });

    const verb = input.attemptType === "check_in" ? "Checked in" : "Checked out";
    return {
      success: true,
      status: "clocked",
      provider: "faceplusplus",
      faceMatchConfidence: comparison.confidence,
      recordId: record.id,
      message: `${verb} successfully. Face++ match ${comparison.confidence.toFixed(1)}%.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Face verification failed";
    if (isDiditConfigured()) {
      return {
        success: false,
        status: "rejected",
        needsDidit: true,
        provider: "didit",
        message: `Face++ error: ${msg}. You can try Didit verification instead.`,
      };
    }
    return { success: false, status: "rejected", message: msg };
  }
}

export async function suggestAttemptType(staffId: string): Promise<ClockAttemptType> {
  const last = await getLastAcceptedType(staffId);
  return last === "check_in" ? "check_out" : "check_in";
}

/** Didit fallback after Face++ fails — auto clock, no admin review. */
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
    .select("id, is_active, organization_id, avatar_url")
    .eq("id", input.staffId)
    .maybeSingle();

  if (!staff?.is_active || staff.organization_id !== input.session.organizationId) {
    return { success: false, status: "rejected", message: "Staff not found." };
  }

  const decision = await import("@/lib/didit/client").then((m) =>
    m.getDiditSessionDecision(input.diditSessionId)
  );

  if (String(decision.raw?.vendor_data || "") !== input.staffId) {
    return {
      success: false,
      status: "rejected",
      message: "Didit verification does not match this staff member.",
    };
  }

  if (!(decision.status === "Approved" && decision.livenessApproved && decision.faceMatchApproved)) {
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
