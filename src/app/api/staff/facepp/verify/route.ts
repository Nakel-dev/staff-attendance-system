import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compareFacesFacePlusPlus,
  isFacePlusPlusConfigured,
} from "@/lib/faceplusplus/client";
import { requireServerMotionValidation } from "@/lib/face/motion-upload";
import { writeAuditLog } from "@/lib/actions/audit";

/** Staff portal: verify live face against profile photo via Face++. Sets face_enrolled_at for kiosk matching. */
export async function POST(request: Request) {
  try {
    if (!isFacePlusPlusConfigured()) {
      return NextResponse.json({ error: "Face++ is not configured" }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .eq("user_id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (!profile.avatar_url) {
      return NextResponse.json(
        { error: "Capture a profile photo first, then complete face verification." },
        { status: 422 }
      );
    }

    const form = await request.formData();
    const motion = await requireServerMotionValidation(form);
    if (!motion.ok) {
      return NextResponse.json({ error: motion.message }, { status: 422 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Live face image is required" }, { status: 400 });
    }

    const liveBytes = new Uint8Array(await file.arrayBuffer());
    if (liveBytes.byteLength < 1000) {
      return NextResponse.json({ error: "Image too small" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profilePhoto } = await admin.storage
      .from("profile-photos")
      .download(profile.avatar_url);

    if (!profilePhoto) {
      return NextResponse.json({ error: "Could not load your profile photo" }, { status: 422 });
    }

    const comparison = await compareFacesFacePlusPlus({
      referenceImageBytes: new Uint8Array(await profilePhoto.arrayBuffer()),
      liveImageBytes: liveBytes,
    });

    if (!comparison.matched) {
      return NextResponse.json(
        {
          error: `Face did not match your profile photo (${comparison.confidence.toFixed(1)}%, need ${comparison.threshold}%). Try again with better lighting.`,
          confidence: comparison.confidence,
          threshold: comparison.threshold,
        },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("profiles")
      .update({
        face_enrolled_at: now,
        face_liveness_score: motion.motionScore,
        updated_at: now,
      })
      .eq("id", profile.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      action: "face_enrolled",
      resourceType: "profile",
      resourceId: profile.id,
      metadata: {
        method: "faceplusplus_portal",
        confidence: comparison.confidence,
        motionScore: motion.motionScore,
      },
    });

    return NextResponse.json({
      success: true,
      enrolledAt: now,
      confidence: comparison.confidence,
      motionScore: motion.motionScore,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Face++ verification failed" },
      { status: 500 }
    );
  }
}
