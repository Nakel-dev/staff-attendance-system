import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBiometricAuthSession, isDiditConfigured } from "@/lib/didit/client";

/** Start Didit biometric identity verification for the signed-in staff member (not clock-in). */
export async function POST(request: Request) {
  try {
    if (!isDiditConfigured()) {
      return NextResponse.json(
        { error: "Didit is not configured. Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID." },
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
      .select("id, full_name, avatar_url, is_active, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_active) {
      return NextResponse.json({ error: "Profile not found or inactive" }, { status: 404 });
    }

    if (!profile.avatar_url) {
      return NextResponse.json(
        {
          error:
            "Upload a clear profile photo first. Didit matches your live face to that photo.",
        },
        { status: 422 }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
      /\/$/,
      ""
    );
    const callbackUrl = `${appUrl}/profile?didit_done=1`;

    const didit = await createBiometricAuthSession({
      staffId: profile.id,
      avatarPath: profile.avatar_url,
      attemptType: "identity_verify",
      callbackUrl,
      metadata: {
        organization_id: profile.organization_id,
        purpose: "staff_portal_identity",
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
        error:
          error instanceof Error ? error.message : "Could not start identity verification",
      },
      { status: 500 }
    );
  }
}
