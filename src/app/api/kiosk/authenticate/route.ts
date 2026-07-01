import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySecret } from "@/lib/kiosk/crypto";
import {
  createKioskSession,
  kioskSessionCookieOptions,
} from "@/lib/kiosk/session";
import {
  KIOSK_ID_COOKIE,
  KIOSK_SESSION_COOKIE,
} from "@/lib/kiosk/constants";

const bodySchema = z.object({
  apiKey: z.string().min(16),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: kiosks } = await admin
      .from("kiosks")
      .select("id, api_key_hash, is_active, organization_id, device_name")
      .eq("is_active", true);

    const kiosk = (kiosks || []).find((row) =>
      verifySecret(parsed.data.apiKey, row.api_key_hash as string)
    );

    if (!kiosk) {
      return NextResponse.json({ error: "Invalid kiosk credentials" }, { status: 401 });
    }

    const sessionToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const { expiresAt } = await createKioskSession(kiosk.id as string, sessionToken);

    const response = NextResponse.json({
      success: true,
      kioskId: kiosk.id,
      deviceName: kiosk.device_name,
      organizationId: kiosk.organization_id,
      expiresAt,
    });

    const cookieOpts = kioskSessionCookieOptions(expiresAt);
    response.cookies.set(KIOSK_SESSION_COOKIE, sessionToken, cookieOpts);
    response.cookies.set(KIOSK_ID_COOKIE, kiosk.id as string, cookieOpts);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 500 }
    );
  }
}
