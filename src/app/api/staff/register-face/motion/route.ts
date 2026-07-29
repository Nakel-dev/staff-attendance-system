import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { requireServerMotionValidation } from "@/lib/face/motion-upload";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";
import { FACE_ANGLES, type FaceAngle } from "@/lib/kiosk/constants";

/** Local enrollment: server-validated motion + profile photo face template. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getAuthenticatedProfile(user.id);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    if (!profile.avatar_url) {
      return NextResponse.json(
        { error: "Capture a reference photo first, then complete face registration." },
        { status: 422 }
      );
    }

    const form = await request.formData();
    const motion = await requireServerMotionValidation(form);
    if (!motion.ok) {
      return NextResponse.json({ error: motion.message }, { status: 422 });
    }

    const descriptor = profile.face_descriptor;
    if (!isValidFaceDescriptor(descriptor)) {
      return NextResponse.json(
        {
          error:
            "Your reference photo is not ready for matching yet. Tap Retake with camera above, wait for “Preparing face matching…” to finish, then try again.",
        },
        { status: 422 }
      );
    }

    const admin = createAdminClient();
    await admin
      .from("face_embeddings")
      .update({ is_active: false })
      .eq("staff_id", profile.id)
      .eq("is_active", true);

    const rows = FACE_ANGLES.map((angle) => ({
      organization_id: profile.organization_id,
      staff_id: profile.id,
      embedding_values: descriptor as number[],
      angle_label: angle as FaceAngle,
      reference_clip_url: null,
      is_active: true,
    }));

    const { error: insertError } = await admin.from("face_embeddings").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const now = new Date().toISOString();
    await admin
      .from("profiles")
      .update({
        face_descriptor: descriptor,
        face_enrolled_at: now,
        face_liveness_score: motion.motionScore,
        updated_at: now,
      })
      .eq("id", profile.id);

    return NextResponse.json({ success: true, enrolledAt: now });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
