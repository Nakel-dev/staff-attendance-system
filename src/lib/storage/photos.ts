import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 3600;

export async function getSignedStorageUrl(
  bucket: string,
  path: string | null | undefined
): Promise<string | undefined> {
  if (!path) return undefined;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

export async function getSignedProfilePhotoUrl(
  path: string | null | undefined
): Promise<string | undefined> {
  return getSignedStorageUrl("profile-photos", path);
}

export async function getSignedKioskPhotoUrl(
  path: string | null | undefined
): Promise<string | undefined> {
  return getSignedStorageUrl("kiosk-attendance-photos", path);
}

export async function enrichProfilesWithPhotoUrls<T extends { avatar_url?: string | null }>(
  profiles: T[]
): Promise<(T & { avatarDisplayUrl?: string })[]> {
  return Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      avatarDisplayUrl: await getSignedProfilePhotoUrl(profile.avatar_url),
    }))
  );
}
