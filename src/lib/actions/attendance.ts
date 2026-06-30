"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@/lib/types";
import type { AttendanceRowInput } from "@/lib/utils/calculateStats";
import { isWithinGeofence } from "@/lib/utils/geofence";
import { compareFaceDescriptors, isValidFaceDescriptor } from "@/lib/utils/faceMatch";
import { validateLivenessFrames } from "@/lib/face/liveness";
import { resolveCheckInPolicy } from "@/lib/utils/securityPolicy";
import { checkInInputSchema } from "@/lib/security/validation";
import { writeAuditLog } from "@/lib/actions/audit";
import { logError } from "@/lib/logging/logger";
import { toClientError } from "@/lib/errors/app-error";
import { format } from "date-fns";

async function notifyStaff(staffId: string, title: string, message: string) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id: staffId,
    title,
    message,
    type: "attendance_marked",
  });
}

async function notifyOrgAdmins(organizationId: string, title: string, message: string) {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .eq("is_active", true);

  if (!admins?.length) return;

  await admin.from("notifications").insert(
    admins.map((adminProfile) => ({
      user_id: adminProfile.user_id,
      title,
      message,
      type: "general",
    }))
  );
}

type VerificationInput = {
  latitude?: number;
  longitude?: number;
  videoPath?: string;
  qrToken?: string;
  faceDescriptor?: number[];
  frameDescriptors?: number[][];
  motionScore?: number;
};

async function validateSelfCheckInVerification({
  org,
  policy,
  profile,
  parsed,
  forCheckOut = false,
}: {
  org: {
    office_latitude: number | null;
    office_longitude: number | null;
    geofence_radius_m: number | null;
    checkin_token: string | null;
    checkin_token_expires_at: string | null;
    attendance_mode?: string | null;
  };
  policy: ReturnType<typeof resolveCheckInPolicy>;
  profile: {
    face_enrolled_at?: string | null;
    face_descriptor?: unknown;
  };
  parsed?: VerificationInput;
  forCheckOut?: boolean;
}) {
  let faceMatchScore: number | null = null;
  let faceMatchPassed: boolean | null = null;
  let livenessPassed: boolean | null = null;
  let livenessScore: number | null = null;
  let verificationFlag = false;
  let verificationNote: string | null = null;

  if (policy.requiresVideo) {
    if (!parsed?.videoPath) {
      return { error: "Video verification is required. Record the 3-second liveness clip." };
    }
    if (!parsed.frameDescriptors || parsed.motionScore == null) {
      return { error: "Live video analysis data is missing. Please record again." };
    }
    const liveness = validateLivenessFrames(parsed.frameDescriptors);
    if (!liveness.passed) {
      return { error: liveness.reason || "Video liveness verification failed" };
    }
    livenessPassed = true;
    livenessScore = liveness.motionScore;
  }

  if (policy.requiresFaceMatch) {
    if (!profile.face_enrolled_at || !profile.face_descriptor) {
      return {
        error: "Face enrollment required. Open Profile and register your face before checking in.",
      };
    }
    if (!parsed?.faceDescriptor || !isValidFaceDescriptor(parsed.faceDescriptor)) {
      return { error: "Face verification data is missing. Record the video verification again." };
    }
    const faceResult = compareFaceDescriptors(
      profile.face_descriptor as number[],
      parsed.faceDescriptor
    );
    if (!faceResult.passed) {
      return {
        error: "Face does not match your enrolled profile. You cannot check in for someone else.",
      };
    }
    faceMatchScore = faceResult.distance;
    faceMatchPassed = true;
  }

  if (!forCheckOut && policy.requiresGeofence) {
    if (parsed?.latitude == null || parsed?.longitude == null) {
      return { error: "Location access is required to check in" };
    }
    if (org.office_latitude == null || org.office_longitude == null) {
      return { error: "Office location is not configured. Contact your administrator." };
    }
    const radius = org.geofence_radius_m ?? 150;
    if (
      !isWithinGeofence(
        parsed.latitude,
        parsed.longitude,
        org.office_latitude,
        org.office_longitude,
        radius
      )
    ) {
      return {
        error: `You must be within ${radius}m of the office to check in`,
      };
    }
  }

  if (!forCheckOut && policy.requiresQr) {
    const token = parsed?.qrToken?.trim().toUpperCase();
    if (!token) {
      return { error: "Scan the reception QR code or enter the desk code shown at the office" };
    }
    const expired =
      !org.checkin_token_expires_at ||
      new Date(org.checkin_token_expires_at).getTime() <= Date.now();
    if (expired || token !== org.checkin_token) {
      return { error: "Invalid or expired desk code. Ask your manager for the current code." };
    }
  }

  if (
    !policy.requiresGeofence &&
    policy.mode === "trust" &&
    parsed?.latitude != null &&
    parsed?.longitude != null &&
    org.office_latitude != null &&
    org.office_longitude != null
  ) {
    const radius = org.geofence_radius_m ?? 150;
    if (
      !isWithinGeofence(
        parsed.latitude,
        parsed.longitude,
        org.office_latitude,
        org.office_longitude,
        radius
      )
    ) {
      verificationFlag = true;
      verificationNote = "Check-in recorded outside office geofence (trust mode)";
    }
  }

  return {
    faceMatchScore,
    faceMatchPassed,
    livenessPassed,
    livenessScore,
    verificationFlag,
    verificationNote,
  };
}

export async function saveAttendanceBatch(
  rows: AttendanceRowInput[],
  date: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    const payload = rows.map((row) => ({
      staff_id: row.staff_id,
      date,
      status: row.status,
      check_in_time: row.check_in_time || null,
      check_out_time: row.check_out_time || null,
      note: row.note || null,
      marked_by: profile.role === "admin" ? profile.id : null,
      check_in_method: profile.role === "admin" ? "admin" : "self",
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "staff_id,date" });

    if (error) return { error: error.message };

    if (profile.role === "admin") {
      for (const row of rows) {
        await notifyStaff(
          row.staff_id,
          "Attendance Marked",
          `Your attendance for ${date} has been marked as ${row.status}.`
        );
      }
    }

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save attendance" };
  }
}

export async function checkInStaff(input?: {
  latitude?: number;
  longitude?: number;
  photoPath?: string;
  videoPath?: string;
  qrToken?: string;
  faceDescriptor?: number[];
  frameDescriptors?: number[][];
  motionScore?: number;
}) {
  try {
    const parsed = input ? checkInInputSchema.parse(input) : undefined;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, organization_id, face_descriptor, face_enrolled_at")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) return { error: "Profile not found" };

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select(
        "attendance_mode, office_latitude, office_longitude, geofence_radius_m, checkin_token, checkin_token_expires_at, require_video_verification, require_face_match, require_geofence, require_qr_code"
      )
      .eq("id", profile.organization_id)
      .single();

    if (!org) return { error: "Organization not found" };

    const policy = resolveCheckInPolicy(org);

    if (!policy.selfCheckInEnabled) {
      return { error: "Self check-in is disabled. Your manager must mark attendance." };
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const now = format(new Date(), "HH:mm:ss");

    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", profile.id)
      .eq("date", today)
      .maybeSingle();

    if (existing?.check_in_time) {
      return { error: "Already checked in today" };
    }

    const verification = await validateSelfCheckInVerification({
      org,
      policy,
      profile,
      parsed,
    });
    if ("error" in verification) return { error: verification.error };

    const {
      faceMatchScore,
      faceMatchPassed,
      livenessPassed,
      livenessScore,
      verificationFlag,
      verificationNote,
    } = verification;

    const checkInMethod = policy.requiresQr ? "qr" : "self";

    const { error } = await supabase.from("attendance").upsert(
      {
        staff_id: profile.id,
        date: today,
        status: "present" as AttendanceStatus,
        check_in_time: now,
        check_in_latitude: parsed?.latitude ?? null,
        check_in_longitude: parsed?.longitude ?? null,
        check_in_photo_url: parsed?.photoPath ?? null,
        check_in_video_url: parsed?.videoPath ?? null,
        check_in_method: checkInMethod,
        verification_flag: verificationFlag,
        verification_note: verificationNote,
        face_match_score: faceMatchScore,
        face_match_passed: faceMatchPassed,
        liveness_passed: livenessPassed,
        liveness_score: livenessScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,date" }
    );

    if (error) return { error: error.message };

    if (verificationFlag) {
      await notifyOrgAdmins(
        profile.organization_id,
        "Flagged check-in",
        `${profile.full_name} checked in with a verification flag: ${verificationNote}`
      );
    }

    await writeAuditLog({
      action: "check_in",
      resourceType: "attendance",
      resourceId: profile.id,
      metadata: {
        mode: policy.mode,
        livenessPassed,
        faceMatchPassed,
        flagged: verificationFlag,
      },
    });

    revalidatePath("/my-attendance");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return { success: true, checkInTime: now, flagged: verificationFlag };
  } catch (err) {
    logError("check_in_failed", { message: err instanceof Error ? err.message : "unknown" });
    return toClientError(err);
  }
}

export async function checkOutStaff(input?: {
  videoPath?: string;
  faceDescriptor?: number[];
  frameDescriptors?: number[][];
  motionScore?: number;
}) {
  try {
    const parsed = input ? checkInInputSchema.parse(input) : undefined;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, face_descriptor, face_enrolled_at")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) return { error: "Profile not found" };

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select(
        "attendance_mode, office_latitude, office_longitude, geofence_radius_m, checkin_token, checkin_token_expires_at, require_video_verification, require_face_match, require_geofence, require_qr_code"
      )
      .eq("id", profile.organization_id)
      .single();

    if (!org) return { error: "Organization not found" };

    const policy = resolveCheckInPolicy(org);

    const today = format(new Date(), "yyyy-MM-dd");
    const now = format(new Date(), "HH:mm:ss");

    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", profile.id)
      .eq("date", today)
      .maybeSingle();

    if (!existing?.check_in_time) {
      return { error: "Check in before checking out" };
    }
    if (existing.check_out_time) {
      return { error: "Already checked out today" };
    }

    const verification = await validateSelfCheckInVerification({
      org,
      policy,
      profile,
      parsed,
      forCheckOut: true,
    });
    if ("error" in verification) return { error: verification.error };

    const { faceMatchPassed, livenessPassed } = verification;

    const { error } = await supabase
      .from("attendance")
      .update({
        check_out_time: now,
        check_out_video_url: parsed?.videoPath ?? null,
        check_out_liveness_passed: livenessPassed,
        check_out_face_match_passed: faceMatchPassed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };

    await writeAuditLog({
      action: "check_out",
      resourceType: "attendance",
      resourceId: profile.id,
      metadata: {
        mode: policy.mode,
        livenessPassed,
        faceMatchPassed,
      },
    });

    revalidatePath("/my-attendance");
    revalidatePath("/attendance");
    return { success: true, checkOutTime: now };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check-out failed" };
  }
}

export async function getFlaggedCheckIns(limit = 10) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin" || !profile.organization_id) {
      return { error: "Unauthorized" };
    }

    const { data: staffInOrg } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id);

    const staffIds = staffInOrg?.map((s) => s.id) || [];
    if (staffIds.length === 0) return { records: [] };

    const { data: records, error } = await supabase
      .from("attendance")
      .select("*, profiles(*)")
      .eq("verification_flag", true)
      .in("staff_id", staffIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { error: error.message };
    return { records: records || [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load flagged check-ins" };
  }
}

export async function clearVerificationFlag(attendanceId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") return { error: "Unauthorized" };

    const { data: record } = await supabase
      .from("attendance")
      .select("staff_id, profiles(organization_id)")
      .eq("id", attendanceId)
      .single();

    const staffOrg = (record?.profiles as { organization_id?: string } | null)?.organization_id;
    if (staffOrg !== profile.organization_id) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("attendance")
      .update({
        verification_flag: false,
        verification_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attendanceId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to clear flag" };
  }
}

export async function getCheckInPhotoSignedUrl(photoPath: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const ownerFolder = photoPath.split("/")[0];
    if (ownerFolder !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, organization_id")
        .eq("user_id", user.id)
        .single();
      if (profile?.role !== "admin") return { error: "Unauthorized" };

      const adminClient = createAdminClient();
      const { data: ownerProfile } = await adminClient
        .from("profiles")
        .select("organization_id")
        .eq("user_id", ownerFolder)
        .maybeSingle();
      if (ownerProfile?.organization_id !== profile.organization_id) {
        return { error: "Unauthorized" };
      }
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from("check-in-photos")
      .createSignedUrl(photoPath, 3600);

    if (error || !data?.signedUrl) return { error: "Could not load photo" };
    return { url: data.signedUrl };
  } catch {
    return { error: "Could not load photo" };
  }
}

export async function getCheckInVideoSignedUrl(videoPath: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const ownerFolder = videoPath.split("/")[0];
    if (ownerFolder !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, organization_id")
        .eq("user_id", user.id)
        .single();
      if (profile?.role !== "admin") return { error: "Unauthorized" };

      const adminClient = createAdminClient();
      const { data: ownerProfile } = await adminClient
        .from("profiles")
        .select("organization_id")
        .eq("user_id", ownerFolder)
        .maybeSingle();
      if (ownerProfile?.organization_id !== profile.organization_id) {
        return { error: "Unauthorized" };
      }
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from("check-in-videos")
      .createSignedUrl(videoPath, 3600);

    if (error || !data?.signedUrl) return { error: "Could not load video" };
    return { url: data.signedUrl };
  } catch {
    return { error: "Could not load video" };
  }
}

export async function getRecentCheckInProofs(limit = 12) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin" || !profile.organization_id) {
      return { error: "Unauthorized" };
    }

    const { data: staffInOrg } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id);

    const staffIds = staffInOrg?.map((s) => s.id) || [];
    if (staffIds.length === 0) return { records: [] };

    const { data: records, error } = await supabase
      .from("attendance")
      .select("*, profiles(*)")
      .in("staff_id", staffIds)
      .not("check_in_video_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { error: error.message };
    return { records: records || [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load check-in proof" };
  }
}
