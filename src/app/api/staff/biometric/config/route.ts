import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDiditConfigured } from "@/lib/didit/client";
import { isAwsRekognitionConfigured } from "@/lib/aws/rekognition";
import { isAwsFaceLivenessConfigured } from "@/lib/aws/face-liveness";
import {
  isBiometricProviderReady,
  normalizeBiometricProvider,
} from "@/lib/biometrics/providers";

/** Staff portal: which biometric provider this organization uses. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("biometric_provider")
    .eq("id", profile.organization_id)
    .maybeSingle();

  const provider = normalizeBiometricProvider(org?.biometric_provider);
  const diditOk = isDiditConfigured();
  const awsOk = isAwsRekognitionConfigured();
  const ready = isBiometricProviderReady(provider, {
    awsConfigured: awsOk,
    diditConfigured: diditOk,
  });

  return NextResponse.json({
    provider,
    ready,
    awsLiveness: isAwsFaceLivenessConfigured(),
    availability: { local: true, didit: diditOk, aws: awsOk },
    setupHint:
      provider === "aws" && !awsOk
        ? "AWS keys are not on the Vercel server yet. Admin must add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION, then redeploy."
        : undefined,
  });
}
