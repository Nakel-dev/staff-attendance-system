import { NextResponse } from "next/server";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { isDiditConfigured } from "@/lib/didit/client";

export async function GET() {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
  }

  return NextResponse.json({
    didit: isDiditConfigured(),
    primary: isDiditConfigured() ? "didit" : "none",
  });
}
