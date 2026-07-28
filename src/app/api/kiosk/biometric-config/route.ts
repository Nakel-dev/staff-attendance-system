import { NextResponse } from "next/server";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDiditConfigured } from "@/lib/didit/client";
import { isAwsRekognitionConfigured } from "@/lib/aws/rekognition";
import { normalizeBiometricProvider } from "@/lib/biometrics/providers";

/** Kiosk: biometric mode for this organization. */
export async function GET() {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("biometric_provider")
    .eq("id", session.organizationId)
    .maybeSingle();

  const provider = normalizeBiometricProvider(org?.biometric_provider);
  const diditOk = isDiditConfigured();
  const awsOk = isAwsRekognitionConfigured();

  let effective = provider;
  if (provider === "didit" && !diditOk) effective = "local";
  if (provider === "aws" && !awsOk) effective = "local";

  return NextResponse.json({
    provider: effective,
    configuredProvider: provider,
    diditConfigured: diditOk,
    awsConfigured: awsOk,
  });
}
