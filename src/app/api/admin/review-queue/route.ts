import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { getSignedKioskPhotoUrl, getSignedProfilePhotoUrl } from "@/lib/storage/photos";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("review_queue")
    .select("*, profiles:staff_id(full_name, employee_code, department, avatar_url)")
    .eq("organization_id", profile.organization_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = await Promise.all(
    (data || []).map(async (item) => {
      const staffProfile = item.profiles as {
        full_name?: string;
        employee_code?: string;
        department?: string;
        avatar_url?: string | null;
      } | null;

      const [liveCaptureSignedUrl, storedReferenceSignedUrl, profilePhotoSignedUrl] =
        await Promise.all([
          getSignedKioskPhotoUrl(item.live_capture_url),
          getSignedProfilePhotoUrl(item.stored_reference_url),
          getSignedProfilePhotoUrl(staffProfile?.avatar_url),
        ]);

      return {
        ...item,
        liveCaptureSignedUrl,
        storedReferenceSignedUrl: storedReferenceSignedUrl || profilePhotoSignedUrl,
        profiles: staffProfile,
      };
    })
  );

  return NextResponse.json({ items });
}
