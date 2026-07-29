import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDiditConfigured } from "@/lib/didit/client";
import { isFacePlusPlusConfigured } from "@/lib/faceplusplus/client";
import {
  isBiometricProviderReady,
  normalizeBiometricProvider,
} from "@/lib/biometrics/providers";

/** Staff portal: org face verification method + deployment availability. */
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

  const portalProvider = normalizeBiometricProvider(org?.biometric_provider);
  const faceppOk = isFacePlusPlusConfigured();
  const diditOk = isDiditConfigured();
  const ready = isBiometricProviderReady(portalProvider, {
    faceplusplusConfigured: faceppOk,
    diditConfigured: diditOk,
  });

  return NextResponse.json({
    provider: portalProvider,
    portalProvider,
    ready,
    availability: { local: true, didit: diditOk, faceplusplus: faceppOk },
    setupHint:
      portalProvider === "faceplusplus" && !faceppOk
        ? "Face++ keys are missing. Add FACEPP_API_KEY and FACEPP_API_SECRET to .env.local."
        : portalProvider === "didit" && !diditOk
          ? "Didit is not configured. Add Didit keys or switch admin settings to Face++."
          : undefined,
  });
}
