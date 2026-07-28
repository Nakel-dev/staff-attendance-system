import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createFaceLivenessSession,
  isAwsFaceLivenessConfigured,
} from "@/lib/aws/face-liveness";

/** Public: start AWS Face Liveness for an active phone clock QR challenge. */
export async function POST(_request: Request, context: { params: { token: string } }) {
  try {
    if (!isAwsFaceLivenessConfigured()) {
      return NextResponse.json({ error: "AWS Face Liveness is not configured" }, { status: 503 });
    }

    const admin = createAdminClient();
    const { data: challenge } = await admin
      .from("phone_clock_challenges")
      .select("status, expires_at")
      .eq("token", context.params.token)
      .maybeSingle();

    if (!challenge || challenge.status !== "pending") {
      return NextResponse.json({ error: "Invalid or expired QR" }, { status: 400 });
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "QR expired" }, { status: 400 });
    }

    const sessionId = await createFaceLivenessSession();
    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start liveness session" },
      { status: 500 }
    );
  }
}
