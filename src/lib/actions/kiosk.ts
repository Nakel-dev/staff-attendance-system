"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { generateApiKey, hashSecret } from "@/lib/kiosk/crypto";

async function requireOrgAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile || profile.role !== "admin" || !profile.organization_id) {
    return { error: "Forbidden" as const };
  }

  return { profile };
}

async function assertKioskInOrg(kioskId: string, organizationId: string) {
  const admin = createAdminClient();
  const { data: kiosk } = await admin
    .from("kiosks")
    .select("id, device_name, is_active")
    .eq("id", kioskId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!kiosk) return { error: "Kiosk not found in your organization" as const };
  return { kiosk, admin };
}

async function invalidateKioskSessions(kioskId: string) {
  const admin = createAdminClient();
  await admin.from("kiosk_sessions").delete().eq("kiosk_id", kioskId);
}

export async function createKioskDevice(input: { deviceName: string; location?: string }) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) return { error: auth.error };

  const apiKey = generateApiKey();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("kiosks")
    .insert({
      organization_id: auth.profile.organization_id,
      device_name: input.deviceName.trim(),
      location: input.location?.trim() || null,
      api_key_hash: hashSecret(apiKey),
      is_active: true,
    })
    .select("id, device_name, location, is_active, created_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { kiosk: data, apiKey };
}

export async function listKioskDevices() {
  const auth = await requireOrgAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("kiosks")
    .select("id, device_name, location, is_active, last_seen_at, created_at")
    .eq("organization_id", auth.profile.organization_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { kiosks: data || [] };
}

export async function toggleKioskDevice(kioskId: string, isActive: boolean) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) return { error: auth.error };

  const scope = await assertKioskInOrg(kioskId, auth.profile.organization_id);
  if ("error" in scope) return { error: scope.error };

  const { error } = await scope.admin
    .from("kiosks")
    .update({ is_active: isActive })
    .eq("id", kioskId)
    .eq("organization_id", auth.profile.organization_id);

  if (error) return { error: error.message };

  if (!isActive) {
    await invalidateKioskSessions(kioskId);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteKioskDevice(kioskId: string) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) return { error: auth.error };

  const scope = await assertKioskInOrg(kioskId, auth.profile.organization_id);
  if ("error" in scope) return { error: scope.error };

  await invalidateKioskSessions(kioskId);

  const { error } = await scope.admin
    .from("kiosks")
    .delete()
    .eq("id", kioskId)
    .eq("organization_id", auth.profile.organization_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
