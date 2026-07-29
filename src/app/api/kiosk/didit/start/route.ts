import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDiditSession, isDiditConfigured } from "@/lib/didit/client";

const bodySchema = z.object({
  staffId: z.string().uuid(),
  attemptType: z.enum(["check_in", "check_out"]),
});

/** Start a Didit session for kiosk clock-in/out (vendor_data = staff profile id). */
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
      .select("id, is_active, organization_id, full_name, face_enrolled_at")
      .eq("id", parsed.data.staffId)
      .maybeSingle();

    if (!staff?.is_active || staff.organization_id !== session.organizationId) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    if (!staff.face_enrolled_at) {
      return NextResponse.json(
        {
          error:
            "Complete Didit KYC verification in the staff portal before using the kiosk.",
        },
        { status: 422 }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
      /\/$/,
      ""
    );
    const callbackUrl = `${appUrl}/kiosk?didit_done=1`;

    const didit = await createDiditSession({
      staffId: staff.id,
      callbackUrl,
      metadata: {
        kiosk_id: session.kioskId,
        organization_id: session.organizationId,
        attempt_type: parsed.data.attemptType,
        source: "attendpro_kiosk",
      },
    });

    return NextResponse.json({
      sessionId: didit.sessionId,
      sessionUrl: didit.sessionUrl,
      staffName: staff.full_name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start Didit verification" },
      { status: 500 }
    );
  }
}
