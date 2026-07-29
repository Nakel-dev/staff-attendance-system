import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyFacePlusPlusAccess } from "@/lib/faceplusplus/client";

/** Admin: verify Face++ env + API reachability. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const verification = await verifyFacePlusPlusAccess();

  return NextResponse.json({
    configured: Boolean(process.env.FACEPP_API_KEY && process.env.FACEPP_API_SECRET),
    ok: verification.ok,
    baseUrl: verification.baseUrl,
    confidenceThreshold: verification.threshold,
    message: verification.message,
  });
}
