import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";

export async function GET(request: Request) {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
  }

  const staffId = new URL(request.url).searchParams.get("staffId");
  if (!staffId) {
    return NextResponse.json({ error: "staffId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("profiles")
    .select("id, is_active, organization_id")
    .eq("id", staffId)
    .maybeSingle();

  if (!staff || staff.organization_id !== session.organizationId || !staff.is_active) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const { data: last } = await admin
    .from("attendance_records")
    .select("type, server_timestamp")
    .eq("staff_id", staffId)
    .in("match_status", ["auto_matched", "manual_override"])
    .order("server_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextAttempt = last?.type === "check_in" ? "check_out" : "check_in";
  return NextResponse.json({
    lastType: last?.type || null,
    lastTimestamp: last?.server_timestamp || null,
    nextAttempt,
  });
}
