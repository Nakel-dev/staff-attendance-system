import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDiditConfigured } from "@/lib/didit/client";
import { normalizeBiometricProvider } from "@/lib/biometrics/providers";

/** Staff portal: Didit KYC config. */
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
  const diditOk = isDiditConfigured();

  return NextResponse.json({
    provider: portalProvider,
    portalProvider,
    ready: diditOk,
    availability: { didit: diditOk },
    setupHint: !diditOk
      ? "Didit is not configured. Add DIDIT_API_KEY and DIDIT_WORKFLOW_ID (KYC workflow from Didit console)."
      : undefined,
  });
}
