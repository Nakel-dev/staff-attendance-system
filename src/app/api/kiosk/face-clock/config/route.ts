import { NextResponse } from "next/server";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { isDiditConfigured } from "@/lib/didit/client";
import { isFacePlusPlusConfigured } from "@/lib/faceplusplus/client";

export async function GET() {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
  }

  return NextResponse.json({
    faceplusplus: isFacePlusPlusConfigured(),
    didit: isDiditConfigured(),
    primary: isFacePlusPlusConfigured() ? "faceplusplus" : isDiditConfigured() ? "didit" : "none",
  });
}
