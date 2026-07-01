import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";
import type { FaceAngle } from "@/lib/kiosk/constants";

const angleSchema = z.enum(["front", "left", "right", "up", "down"]);

const bodySchema = z.object({
  embeddings: z.array(
    z.object({
      angle: angleSchema,
      descriptor: z.array(z.number()).length(128),
      referenceClipUrl: z.string().optional(),
    })
  ).min(5),
  referenceClipUrl: z.string().optional(),
  motionScore: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getAuthenticatedProfile(user.id);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
    }

    const angles = new Set(parsed.data.embeddings.map((e) => e.angle));
    if (angles.size < 5) {
      return NextResponse.json({ error: "All five face angles are required" }, { status: 400 });
    }

    for (const item of parsed.data.embeddings) {
      if (!isValidFaceDescriptor(item.descriptor)) {
        return NextResponse.json({ error: `Invalid descriptor for ${item.angle}` }, { status: 400 });
      }
    }

    const admin = createAdminClient();

    await admin
      .from("face_embeddings")
      .update({ is_active: false })
      .eq("staff_id", profile.id)
      .eq("is_active", true);

    const rows = parsed.data.embeddings.map((item) => ({
      organization_id: profile.organization_id,
      staff_id: profile.id,
      embedding_values: item.descriptor,
      angle_label: item.angle as FaceAngle,
      reference_clip_url: item.referenceClipUrl || parsed.data.referenceClipUrl || null,
      is_active: true,
    }));

    const { error: insertError } = await admin.from("face_embeddings").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    await admin
      .from("profiles")
      .update({
        face_descriptor: parsed.data.embeddings.find((e) => e.angle === "front")?.descriptor,
        face_enrolled_at: new Date().toISOString(),
        face_reference_video_url: parsed.data.referenceClipUrl || null,
        face_liveness_score: parsed.data.motionScore ?? null,
      })
      .eq("id", profile.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
