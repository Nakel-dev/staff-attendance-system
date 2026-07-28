import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";

const bodySchema = z.object({
  descriptor: z.array(z.number()).length(128),
});

/** Save face template extracted from profile photo on the client. */
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
    if (!parsed.success || !isValidFaceDescriptor(parsed.data.descriptor)) {
      return NextResponse.json({ error: "Invalid face template" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        face_descriptor: parsed.data.descriptor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save face template" },
      { status: 500 }
    );
  }
}
