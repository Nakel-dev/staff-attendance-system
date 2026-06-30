"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";

export async function getFaceEnrollmentStatus() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("face_enrolled_at, face_reference_photo_url")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    return {
      enrolled: !!profile.face_enrolled_at,
      enrolledAt: profile.face_enrolled_at,
      referencePhotoPath: profile.face_reference_photo_url,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load face enrollment" };
  }
}

export async function enrollFace(input: {
  descriptor: number[];
  referencePhotoPath?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!isValidFaceDescriptor(input.descriptor)) {
      return { error: "Invalid face data. Please capture your face again." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        face_descriptor: input.descriptor,
        face_enrolled_at: new Date().toISOString(),
        face_reference_photo_url: input.referencePhotoPath || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/profile");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Face enrollment failed" };
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
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/profile");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to clear face enrollment" };
  }
}
