"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
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

    const { data: org, error } = await auth.supabase
      .from("organizations")
      .select("id, name, invite_code, slug, created_at")
      .eq("id", auth.profile.organization_id)
      .single();

    if (error || !org) return { error: "Organization not found" };
    return { organization: org };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load settings" };
  }
}
