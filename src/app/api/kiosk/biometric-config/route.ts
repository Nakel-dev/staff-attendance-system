import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { isDiditConfigured } from "@/lib/didit/client";
import { isFacePlusPlusConfigured } from "@/lib/faceplusplus/client";
import {
  isBiometricProviderReady,
  normalizeBiometricProvider,
} from "@/lib/biometrics/providers";

/** Kiosk: biometric mode for this organization. */
export async function GET() {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("biometric_provider")
    .eq("id", session.organizationId)
    .maybeSingle();

  const provider = normalizeBiometricProvider(org?.biometric_provider);
  const faceppOk = isFacePlusPlusConfigured();
  const diditOk = isDiditConfigured();
  const ready = isBiometricProviderReady(provider, {
    faceplusplusConfigured: faceppOk,
    diditConfigured: diditOk,
  });

  return NextResponse.json({
    provider,
    ready,
    faceplusplusConfigured: faceppOk,
    diditConfigured: diditOk,
  });
}
