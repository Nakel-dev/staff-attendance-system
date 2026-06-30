"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCheckInPolicy } from "@/lib/utils/securityPolicy";
import { revalidatePath } from "next/cache";
import type { AttendanceMode } from "@/lib/types";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateCheckInToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function requireOrgAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin" || !profile.organization_id) {
    return { error: "Unauthorized" as const };
  }

  return { profile, supabase };
}

export async function updateOrganizationName(name: string) {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const trimmed = name.trim();
    if (trimmed.length < 2) return { error: "Organization name must be at least 2 characters" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("organizations")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", auth.profile.organization_id);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update organization" };
  }
}

export async function regenerateInviteCode() {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const admin = createAdminClient();
    let inviteCode = generateInviteCode();

    for (let i = 0; i < 10; i++) {
      const { data: existing } = await admin
        .from("organizations")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      if (!existing) break;
      inviteCode = generateInviteCode();
    }

    const { error } = await admin
      .from("organizations")
      .update({ invite_code: inviteCode, updated_at: new Date().toISOString() })
      .eq("id", auth.profile.organization_id);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, inviteCode };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to regenerate invite code" };
  }
}

export async function getOrganizationSettings() {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .select(
        "id, name, invite_code, slug, created_at, attendance_mode, office_latitude, office_longitude, geofence_radius_m, require_video_verification, require_face_match, require_geofence, require_qr_code"
      )
      .eq("id", auth.profile.organization_id)
      .single();

    if (error || !org) return { error: error?.message || "Organization not found" };
    return { organization: org };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load settings" };
  }
}

export async function updateAttendanceSecuritySettings(input: {
  attendanceMode: AttendanceMode;
  officeLatitude: number | null;
  officeLongitude: number | null;
  geofenceRadiusM: number;
  requireVideoVerification: boolean;
  requireFaceMatch: boolean;
  requireGeofence: boolean;
  requireQrCode: boolean;
}) {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    if (input.geofenceRadiusM < 50 || input.geofenceRadiusM > 5000) {
      return { error: "Geofence radius must be between 50 and 5000 meters" };
    }

    if (
      input.requireGeofence &&
      (input.officeLatitude == null || input.officeLongitude == null)
    ) {
      return { error: "Office location is required when geofence verification is enabled" };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("organizations")
      .update({
        attendance_mode: input.attendanceMode,
        office_latitude: input.officeLatitude,
        office_longitude: input.officeLongitude,
        geofence_radius_m: input.geofenceRadiusM,
        require_video_verification: input.requireVideoVerification,
        require_face_match: input.requireFaceMatch,
        require_geofence: input.requireGeofence,
        require_qr_code: input.requireQrCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.profile.organization_id);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    revalidatePath("/my-attendance");
    revalidatePath("/attendance");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update security settings" };
  }
}

export async function refreshCheckInKioskToken() {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("attendance_mode")
      .eq("id", auth.profile.organization_id)
      .single();

    if (org?.attendance_mode !== "strict") {
      return { error: "Rotating desk codes are only used in Strict mode" };
    }

    const token = generateCheckInToken();
    const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

    const { error } = await admin
      .from("organizations")
      .update({
        checkin_token: token,
        checkin_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.profile.organization_id);

    if (error) return { error: error.message };

    return { success: true, token, expiresAt };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to refresh desk code" };
  }
}

export async function getCheckInKioskState() {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .select("attendance_mode, checkin_token, checkin_token_expires_at")
      .eq("id", auth.profile.organization_id)
      .single();

    if (error || !org) return { error: error?.message || "Organization not found" };
    if (org.attendance_mode !== "strict") {
      return { enabled: false as const, mode: org.attendance_mode };
    }

    const expired =
      !org.checkin_token ||
      !org.checkin_token_expires_at ||
      new Date(org.checkin_token_expires_at).getTime() <= Date.now();

    if (expired) {
      const refreshed = await refreshCheckInKioskToken();
      if ("error" in refreshed) return refreshed;
      return {
        enabled: true as const,
        token: refreshed.token!,
        expiresAt: refreshed.expiresAt!,
      };
    }

    return {
      enabled: true as const,
      token: org.checkin_token!,
      expiresAt: org.checkin_token_expires_at!,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load desk code" };
  }
}

export async function getStaffCheckInPolicy() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, face_enrolled_at")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) return { error: "Profile not found" };

    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .select(
        "attendance_mode, office_latitude, office_longitude, geofence_radius_m, require_video_verification, require_face_match, require_geofence, require_qr_code"
      )
      .eq("id", profile.organization_id)
      .single();

    if (error || !org) return { error: error?.message || "Organization not found" };

    const policy = resolveCheckInPolicy(org);

    return {
      policy: {
        ...policy,
        faceEnrolled: !!profile.face_enrolled_at,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load check-in policy" };
  }
}
