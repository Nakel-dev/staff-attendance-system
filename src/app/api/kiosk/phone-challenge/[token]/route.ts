import { NextResponse } from "next/server";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { getPhoneChallengeStatusForKiosk } from "@/lib/kiosk/phone-challenge";

/** Kiosk polls until phone finishes (or QR expires). */
export async function GET(
  request: Request,
  context: { params: { token: string } }
) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
    }

    const { token } = context.params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const result = await getPhoneChallengeStatusForKiosk(token, session.kioskId);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: typeof result.status === "number" ? result.status : 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
