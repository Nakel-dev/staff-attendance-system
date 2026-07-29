import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/actions/audit";
import {
  DiditValidationError,
  getDiditSessionDecision,
  isDiditConfigured,
  isKycEnrollmentApproved,
  isTerminalDiditStatus,
  validateDiditEnrollmentSession,
} from "@/lib/didit/client";

/**
 * Poll Didit KYC decision for staff-portal identity verification.
 * On Approved KYC, marks the profile as verified (face_enrolled_at).
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

    let decision;
    try {
      decision = await getDiditSessionDecision(sessionId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not read Didit status" },
        { status: 502 }
      );
    }

    const terminal = isTerminalDiditStatus(decision.status);
    let approved = isKycEnrollmentApproved(decision);

    if (approved) {
      try {
        decision = await validateDiditEnrollmentSession(profile.id, sessionId);
      } catch (error) {
        approved = false;
        if (error instanceof DiditValidationError) {
          return NextResponse.json({
            sessionId: decision.sessionId,
            status: decision.status,
            terminal,
            approved: false,
            error: error.message,
            idVerificationApproved: decision.idVerificationApproved,
            livenessApproved: decision.livenessApproved,
            faceMatchApproved: decision.faceMatchApproved,
            faceMatchScore: decision.faceMatchScore,
            livenessScore: decision.livenessScore,
            enrolled: false,
            enrolledAt: null,
          });
        }
        throw error;
      }
    }

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
            method: "didit_kyc",
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
      idVerificationApproved: decision.idVerificationApproved,
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
