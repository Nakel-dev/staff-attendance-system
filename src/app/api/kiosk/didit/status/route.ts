import { NextResponse } from "next/server";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import {
  getDiditSessionDecision,
  isDiditClockApproved,
  isDiditConfigured,
  isTerminalDiditStatus,
} from "@/lib/didit/client";

export async function GET(request: Request) {
  try {
    if (!isDiditConfigured()) {
      return NextResponse.json({ error: "Didit is not configured" }, { status: 503 });
    }

    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const decision = await getDiditSessionDecision(sessionId);
    const clockApproved = isDiditClockApproved(decision);

    return NextResponse.json({
      sessionId: decision.sessionId,
      status: decision.status,
      terminal: isTerminalDiditStatus(decision.status),
      clockApproved,
      livenessApproved: decision.livenessApproved,
      faceMatchApproved: decision.faceMatchApproved,
      faceMatchScore: decision.faceMatchScore,
      livenessScore: decision.livenessScore,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read Didit status" },
      { status: 500 }
    );
  }
}
