import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createFaceLivenessSession,
  isAwsFaceLivenessConfigured,
} from "@/lib/aws/face-liveness";

/** Staff portal: start an AWS Face Liveness session for enrollment. */
export async function POST() {
  try {
    if (!isAwsFaceLivenessConfigured()) {
      return NextResponse.json(
        {
          error:
            "AWS Face Liveness is not configured. Add NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID — see BIOMETRIC_SETUP.md.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = await createFaceLivenessSession();
    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start liveness session" },
      { status: 500 }
    );
  }
}
