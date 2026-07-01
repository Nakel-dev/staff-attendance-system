"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { generateApiKey, hashSecret } from "@/lib/kiosk/crypto";

export async function createKioskDevice(input: { deviceName: string; location?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile || profile.role !== "admin") return { error: "Forbidden" };

  const apiKey = generateApiKey();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("kiosks")
    .insert({
      organization_id: profile.organization_id,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile || profile.role !== "admin") return { error: "Forbidden" };

  const { data, error } = await supabase
    .from("kiosks")
    .select("id, device_name, location, is_active, last_seen_at, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { kiosks: data || [] };
}

export async function toggleKioskDevice(kioskId: string, isActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile || profile.role !== "admin") return { error: "Forbidden" };

  const { error } = await supabase
    .from("kiosks")
    .update({ is_active: isActive })
    .eq("id", kioskId)
    .eq("organization_id", profile.organization_id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
