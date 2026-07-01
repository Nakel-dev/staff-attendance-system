import { NextResponse } from "next/server";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";

export async function GET() {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    deviceName: session.deviceName,
    kioskId: session.kioskId,
  });
}
