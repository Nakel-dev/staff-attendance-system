import { NextResponse } from "next/server";
import { completePhoneClockChallenge } from "@/lib/kiosk/phone-challenge";
import { createDiditSession, isDiditConfigured } from "@/lib/didit/client";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public: phone completes Didit verification for a kiosk QR challenge. */
export async function POST(
  request: Request,
  context: { params: { token: string } }
) {
  try {
    const { token } = context.params;
    const body = (await request.json()) as {
      action?: string;
      diditSessionId?: string;
    };

    if (body.action === "start_didit") {
      if (!isDiditConfigured()) {
        return NextResponse.json({ error: "Didit is not configured" }, { status: 503 });
      }
      const admin = createAdminClient();
      const { data: challenge } = await admin
        .from("phone_clock_challenges")
        .select("staff_id, status, expires_at, attempt_type")
        .eq("token", token)
        .maybeSingle();
      if (!challenge || challenge.status !== "pending") {
        return NextResponse.json({ error: "Invalid or expired QR" }, { status: 400 });
      }
      if (new Date(challenge.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: "QR expired" }, { status: 400 });
      }
      const { data: staff } = await admin
        .from("profiles")
        .select("id, face_enrolled_at")
        .eq("id", challenge.staff_id)
        .single();
      if (!staff?.face_enrolled_at) {
        return NextResponse.json(
          { error: "Complete Didit KYC in the staff portal first." },
          { status: 422 }
        );
      }
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
        /\/$/,
        ""
      );
      const attemptType =
        challenge.attempt_type === "check_out" ? "check_out" : "check_in";
      const didit = await createDiditSession({
        staffId: staff.id,
        callbackUrl: `${appUrl}/clock/${token}?didit_done=1`,
        metadata: { source: "phone_clock_qr", token, attempt_type: attemptType },
      });
      return NextResponse.json({
        sessionId: didit.sessionId,
        sessionUrl: didit.sessionUrl,
      });
    }

    const result = await completePhoneClockChallenge({
      token,
      diditSessionId: body.diditSessionId,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not complete clock" },
      { status: 500 }
    );
  }
}
