"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getSignedProfilePhotoUrl } from "@/lib/storage/photos";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function requireProfileAccess(staffProfileId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("user_id", user.id)
    .single();

  if (!actor) return { error: "Unauthorized" as const };

  const targetId = staffProfileId || actor.id;
  if (targetId !== actor.id && actor.role !== "admin") {
    return { error: "Unauthorized" as const };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", targetId)
    .single();

  if (!target || target.organization_id !== actor.organization_id) {
    return { error: "Profile not found" as const };
  }

  return { actor, target, admin };
}

export async function uploadProfilePhoto(formData: FormData, staffProfileId?: string) {
  try {
    const access = await requireProfileAccess(staffProfileId);
    if ("error" in access) return { error: access.error };

    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "No photo selected" };

    if (file.size > MAX_BYTES) return { error: "Photo must be under 5MB" };
    if (!ALLOWED_TYPES.has(file.type)) {
      return { error: "Use JPEG, PNG, or WebP" };
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${access.target.organization_id}/${access.target.id}/avatar-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await access.admin.storage
      .from("profile-photos")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) return { error: uploadError.message };

    const { error: updateError } = await access.admin
      .from("profiles")
      .update({ avatar_url: path, updated_at: new Date().toISOString() })
      .eq("id", access.target.id);

    if (updateError) return { error: updateError.message };

    revalidatePath("/profile");
    revalidatePath("/staff");
    revalidatePath(`/staff/${access.target.id}`);

    const signedUrl = await getSignedProfilePhotoUrl(path);
    return { success: true, path, signedUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
}

export async function getProfilePhotoUrl(path: string | null | undefined) {
  const signedUrl = await getSignedProfilePhotoUrl(path);
  return { signedUrl };
}
