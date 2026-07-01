import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret, verifySecret } from "@/lib/kiosk/crypto";
import {
  KIOSK_ID_COOKIE,
  KIOSK_SESSION_COOKIE,
  KIOSK_SESSION_TTL_HOURS,
} from "@/lib/kiosk/constants";

export interface KioskSessionContext {
  sessionId: string;
  kioskId: string;
  organizationId: string;
  deviceName: string;
}

export async function createKioskSession(kioskId: string, sessionToken: string) {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + KIOSK_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("kiosk_sessions")
    .insert({
      kiosk_id: kioskId,
      session_token_hash: hashSecret(sessionToken),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { sessionId: data.id as string, expiresAt };
}

export async function getKioskSessionFromCookies(): Promise<KioskSessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(KIOSK_SESSION_COOKIE)?.value;
  const kioskId = cookieStore.get(KIOSK_ID_COOKIE)?.value;
  if (!token || !kioskId) return null;

  const admin = createAdminClient();
  const { data: kiosk } = await admin
    .from("kiosks")
    .select("id, organization_id, device_name, is_active")
    .eq("id", kioskId)
    .maybeSingle();

  if (!kiosk?.is_active) return null;

  const { data: sessions } = await admin
    .from("kiosk_sessions")
    .select("id, session_token_hash, expires_at")
    .eq("kiosk_id", kioskId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  const match = (sessions || []).find((row) =>
    verifySecret(token, row.session_token_hash as string)
  );
  if (!match) return null;

  await admin
    .from("kiosks")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", kioskId);

  return {
    sessionId: match.id as string,
    kioskId: kiosk.id as string,
    organizationId: kiosk.organization_id as string,
    deviceName: kiosk.device_name as string,
  };
}

export function kioskSessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}
