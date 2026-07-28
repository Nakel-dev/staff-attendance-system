import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compareFacesAws, isAwsRekognitionConfigured } from "@/lib/aws/rekognition";
import { writeAuditLog } from "@/lib/actions/audit";

/** Staff portal: verify live selfie against profile photo via AWS CompareFaces. */
export async function POST(request: Request) {
  try {
    if (!isAwsRekognitionConfigured()) {
      return NextResponse.json({ error: "AWS Rekognition is not configured" }, { status: 503 });
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
        { error: "Upload a profile photo first, then verify with AWS." },
        { status: 422 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Live face image is required" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength < 1000) {
      return NextResponse.json({ error: "Image too small" }, { status: 400 });
    }

    const comparison = await compareFacesAws({
      sourceAvatarPath: profile.avatar_url,
      targetImageBytes: bytes,
    });

    if (!comparison.matched) {
      return NextResponse.json(
        {
          error: `Face did not match your profile photo (similarity ${comparison.similarity.toFixed(1)}%). Try again with better lighting.`,
          similarity: comparison.similarity,
        },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        face_enrolled_at: now,
        face_liveness_score: comparison.similarity,
        updated_at: now,
      })
      .eq("id", profile.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      action: "face_enrolled",
      resourceType: "profile",
      resourceId: profile.id,
      metadata: { method: "aws_compare_faces", similarity: comparison.similarity },
    });

    return NextResponse.json({
      success: true,
      enrolledAt: now,
      similarity: comparison.similarity,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AWS verification failed" },
      { status: 500 }
    );
  }
}
