import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/actions/audit";
import {
  getDiditSessionDecision,
  isDiditConfigured,
  isTerminalDiditStatus,
} from "@/lib/didit/client";

/**
 * Poll Didit decision for staff-portal identity verification.
 * On Approved, marks the profile as face-verified (enrollment complete).
 */
export async function GET(request: Request) {
  try {
    if (!isDiditConfigured()) {
      return NextResponse.json({ error: "Didit is not configured" }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const decision = await getDiditSessionDecision(sessionId);
    const terminal = isTerminalDiditStatus(decision.status);
    const approved =
      decision.status === "Approved" &&
      decision.livenessApproved &&
      decision.faceMatchApproved;

    let enrolled = false;
    let enrolledAt: string | null = null;

    if (approved) {
      const now = new Date().toISOString();
      const admin = createAdminClient();
      const { error } = await admin
        .from("profiles")
        .update({
          face_enrolled_at: now,
          face_liveness_score: decision.livenessScore ?? null,
          updated_at: now,
        })
        .eq("id", profile.id);

      if (!error) {
        enrolled = true;
        enrolledAt = now;
        await writeAuditLog({
          action: "face_enrolled",
          resourceType: "profile",
          resourceId: profile.id,
          metadata: {
            method: "didit",
            sessionId: decision.sessionId,
            faceMatchScore: decision.faceMatchScore,
            livenessScore: decision.livenessScore,
          },
        });
      }
    }

    return NextResponse.json({
      sessionId: decision.sessionId,
      status: decision.status,
      terminal,
      approved,
      livenessApproved: decision.livenessApproved,
      faceMatchApproved: decision.faceMatchApproved,
      faceMatchScore: decision.faceMatchScore,
      livenessScore: decision.livenessScore,
      enrolled,
      enrolledAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not read Didit status",
      },
      { status: 500 }
    );
  }
}
