import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { isValidKioskPin } from "@/lib/kiosk/pin";
import { createPhoneClockChallenge } from "@/lib/kiosk/phone-challenge";

const bodySchema = z.object({
  staffId: z.string().uuid(),
  attemptType: z.enum(["check_in", "check_out"]),
  pin: z.string(),
});

/** Kiosk: after PIN, create a 60s QR for phone face verification. */
export async function POST(request: Request) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!isValidKioskPin(parsed.data.pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }

    const result = await createPhoneClockChallenge({
      session,
      staffId: parsed.data.staffId,
      attemptType: parsed.data.attemptType,
      pin: parsed.data.pin,
      requestUrl: request.url,
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: typeof result.status === "number" ? result.status : 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create QR challenge" },
      { status: 500 }
    );
  }
}
