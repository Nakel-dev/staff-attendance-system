import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDiditSession, isDiditConfigured } from "@/lib/didit/client";

/** Start Didit KYC identity verification for the signed-in staff member. */
export async function POST(request: Request) {
  try {
    if (!isDiditConfigured()) {
      return NextResponse.json(
        {
          error:
            "Didit is not configured. Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID (KYC workflow from Didit console).",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, is_active, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_active) {
      return NextResponse.json({ error: "Profile not found or inactive" }, { status: 404 });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
      /\/$/,
      ""
    );
    const callbackUrl = `${appUrl}/profile?didit_done=1`;

    const didit = await createDiditSession({
      staffId: profile.id,
      callbackUrl,
      metadata: {
        organization_id: profile.organization_id,
        purpose: "staff_portal_kyc",
        source: "attendpro_staff_portal",
      },
    });

    return NextResponse.json({
      sessionId: didit.sessionId,
      sessionUrl: didit.sessionUrl,
      staffName: profile.full_name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not start KYC verification",
      },
      { status: 500 }
    );
  }
}
