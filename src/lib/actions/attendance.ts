"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { AttendanceRowInput } from "@/lib/utils/calculateStats";

async function notifyStaff(staffId: string, title: string, message: string) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id: staffId,
    title,
    message,
    type: "attendance_marked",
  });
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

export async function checkInStaff(_input?: {
  latitude?: number;
  longitude?: number;
  photoPath?: string;
  videoPath?: string;
  qrToken?: string;
  faceDescriptor?: number[];
  frameDescriptors?: number[][];
  motionScore?: number;
}): Promise<{ error: string } | { success: true; checkInTime: string; flagged: boolean }> {
  void _input;
  return {
    error:
      "Clock in and out only at the reception kiosk using facial verification. You cannot clock in from the staff portal.",
  };
}

export async function checkOutStaff(_input?: {
  videoPath?: string;
  faceDescriptor?: number[];
  frameDescriptors?: number[][];
  motionScore?: number;
}): Promise<{ error: string } | { success: true; checkOutTime: string }> {
  void _input;
  return {
    error:
      "Clock in and out only at the reception kiosk using facial verification. You cannot clock out from the staff portal.",
  };
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
