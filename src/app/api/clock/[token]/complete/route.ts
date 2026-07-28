import { NextResponse } from "next/server";
import { completePhoneClockChallenge } from "@/lib/kiosk/phone-challenge";
import { createBiometricAuthSession, isDiditConfigured } from "@/lib/didit/client";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public: phone completes face verification for a kiosk QR challenge. */
export async function POST(
  request: Request,
  context: { params: { token: string } }
) {
  try {
    const { token } = context.params;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
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
          .select("id, avatar_url")
          .eq("id", challenge.staff_id)
          .single();
        if (!staff?.avatar_url) {
          return NextResponse.json({ error: "Profile photo missing" }, { status: 422 });
        }
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
          /\/$/,
          ""
        );
        const attemptType =
          challenge.attempt_type === "check_out" ? "check_out" : "check_in";
        const didit = await createBiometricAuthSession({
          staffId: staff.id,
          avatarPath: staff.avatar_url,
          attemptType,
          callbackUrl: `${appUrl}/clock/${token}?didit_done=1`,
          metadata: { source: "phone_clock_qr", token },
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
    }

    const form = await request.formData();
    const file = form.get("file");
    const diditSessionId = String(form.get("diditSessionId") || "") || undefined;
    let photoBytes: Uint8Array | undefined;
    if (file instanceof File) {
      photoBytes = new Uint8Array(await file.arrayBuffer());
    }

    let faceDescriptor: number[] | undefined;
    const descriptorRaw = form.get("faceDescriptor");
    if (typeof descriptorRaw === "string" && descriptorRaw.trim()) {
      try {
        const parsed = JSON.parse(descriptorRaw) as unknown;
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
          faceDescriptor = parsed;
        }
      } catch {
        /* ignore invalid descriptor */
      }
    }

    const result = await completePhoneClockChallenge({
      token,
      photoBytes,
      faceDescriptor,
      diditSessionId,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not complete clock" },
      { status: 500 }
    );
  }
}
