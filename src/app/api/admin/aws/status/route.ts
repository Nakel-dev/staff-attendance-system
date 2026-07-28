import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isAwsRekognitionConfigured,
  verifyAwsRekognitionAccess,
} from "@/lib/aws/rekognition";
import { isAwsFaceLivenessConfigured } from "@/lib/aws/face-liveness";

/** Admin: verify AWS Rekognition env + IAM in this deployment. */
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

  const configured = isAwsRekognitionConfigured();
  const verification = configured ? await verifyAwsRekognitionAccess() : null;

  return NextResponse.json({
    configured,
    livenessConfigured: isAwsFaceLivenessConfigured(),
    ok: verification?.ok ?? false,
    region: verification?.region,
    similarityThreshold: verification?.similarityThreshold,
    message: verification?.message ?? "AWS environment variables are not set on this server.",
  });
}
