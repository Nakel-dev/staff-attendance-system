import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export async function getProfileWithOrganization(userId: string) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, organizations(name, invite_code)")
    .eq("user_id", userId)
    .single();

  if (profile && !error) {
    return profile as Profile & { organizations?: { name: string; invite_code: string } | null };
  }

  // Fallback when RLS blocks read (should be rare after policy fix)
  const admin = createAdminClient();
  const { data: adminProfile } = await admin
    .from("profiles")
    .select("*, organizations(name, invite_code)")
    .eq("user_id", userId)
    .single();

  return adminProfile as
    | (Profile & { organizations?: { name: string; invite_code: string } | null })
    | null;
}

export async function getAuthenticatedProfile(userId: string) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profile && !error) return profile as Profile;

  const admin = createAdminClient();
  const { data: adminProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  return (adminProfile as Profile | null) ?? null;
}

export function getOrganizationDisplayName(
  profile: { organizations?: { name: string } | null } | null
) {
  return profile?.organizations?.name || "Your Organization";
}
