"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/actions/audit";
import { logError } from "@/lib/logging/logger";
import { faceEnrollmentSchema } from "@/lib/security/validation";
import { validateLivenessFrames } from "@/lib/face/liveness";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";
import { toClientError } from "@/lib/errors/app-error";

export async function getFaceEnrollmentStatus() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("face_enrolled_at, face_reference_photo_url, face_reference_video_url")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    return {
      enrolled: !!profile.face_enrolled_at,
      enrolledAt: profile.face_enrolled_at,
      referencePhotoPath: profile.face_reference_photo_url,
      referenceVideoPath: profile.face_reference_video_url,
    };
  } catch (err) {
    logError("face_enrollment_status_failed", { message: err instanceof Error ? err.message : "unknown" });
    return { error: "Failed to load face enrollment" };
  }
}

export async function enrollFace(input: {
  descriptor: number[];
  referencePhotoPath?: string;
  referenceVideoPath?: string;
  motionScore: number;
  frameDescriptors: number[][];
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const parsed = faceEnrollmentSchema.parse(input);
    if (!isValidFaceDescriptor(parsed.descriptor)) {
      return { error: "Invalid face data. Please record your verification video again." };
    }

    const liveness = validateLivenessFrames(parsed.frameDescriptors);
    if (!liveness.passed) {
      return { error: liveness.reason || "Video liveness verification failed" };
    }

    if (!parsed.referenceVideoPath) {
      return { error: "Enrollment video is required" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        face_descriptor: parsed.descriptor,
        face_enrolled_at: new Date().toISOString(),
        face_reference_photo_url: parsed.referencePhotoPath || null,
        face_reference_video_url: parsed.referenceVideoPath,
        face_liveness_score: liveness.motionScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) return { error: error.message };

    await writeAuditLog({
      action: "face_enrolled",
      resourceType: "profile",
      resourceId: profile.id,
      metadata: { motionScore: liveness.motionScore },
    });

    revalidatePath("/profile");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    logError("face_enrollment_failed", { message: err instanceof Error ? err.message : "unknown" });
    return toClientError(err);
  }
}

export async function clearFaceEnrollment() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("profiles")
      .update({
        face_descriptor: null,
        face_enrolled_at: null,
        face_reference_photo_url: null,
        face_reference_video_url: null,
        face_liveness_score: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    await writeAuditLog({
      action: "face_enrollment_cleared",
      resourceType: "profile",
    });

    revalidatePath("/profile");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    return toClientError(err);
  }
}
