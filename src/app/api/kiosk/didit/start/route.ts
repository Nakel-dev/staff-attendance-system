import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { verifyKioskPin } from "@/lib/kiosk/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBiometricAuthSession, isDiditConfigured } from "@/lib/didit/client";

const bodySchema = z.object({
  staffId: z.string().uuid(),
  attemptType: z.enum(["check_in", "check_out"]),
  pin: z.string().regex(/^\d{4}$/),
});

export async function POST(request: Request) {
  try {
    if (!isDiditConfigured()) {
      return NextResponse.json(
        { error: "Didit is not configured. Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID." },
        { status: 503 }
      );
    }

    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("profiles")
      .select("id, is_active, organization_id, kiosk_pin_hash, avatar_url, full_name")
      .eq("id", parsed.data.staffId)
      .maybeSingle();

    if (!staff?.is_active || staff.organization_id !== session.organizationId) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    if (!staff.kiosk_pin_hash || !verifyKioskPin(parsed.data.pin, staff.kiosk_pin_hash)) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    if (!staff.avatar_url) {
      return NextResponse.json(
        { error: "No profile photo on file. Upload a profile photo before face clock-in." },
        { status: 422 }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
      /\/$/,
      ""
    );
    const callbackUrl = `${appUrl}/kiosk?didit_done=1`;

    const didit = await createBiometricAuthSession({
      staffId: staff.id,
      avatarPath: staff.avatar_url,
      attemptType: parsed.data.attemptType,
      callbackUrl,
      metadata: {
        kiosk_id: session.kioskId,
        organization_id: session.organizationId,
      },
    });

    return NextResponse.json({
      sessionId: didit.sessionId,
      sessionUrl: didit.sessionUrl,
      staffName: staff.full_name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start face verification" },
      { status: 500 }
    );
  }
}
