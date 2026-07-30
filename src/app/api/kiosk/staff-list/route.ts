import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { backfillMissingEmployeeCodes } from "@/lib/staff/employee-code";

function nextAttemptFromLast(lastType: string | null | undefined): "check_in" | "check_out" {
  return lastType === "check_in" ? "check_out" : "check_in";
}

export async function GET(request: Request) {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
  }

  await backfillMissingEmployeeCodes(session.organizationId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, department, employee_code")
    .eq("organization_id", session.organizationId)
    .eq("role", "staff")
    .eq("is_active", true)
    .not("face_enrolled_at", "is", null)
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const staff = data || [];
  const staffIds = staff.map((s) => s.id);

  const lastByStaff = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: records } = await admin
      .from("attendance_records")
      .select("staff_id, type, server_timestamp")
      .eq("organization_id", session.organizationId)
      .in("match_status", ["auto_matched", "manual_override"])
      .in("staff_id", staffIds)
      .order("server_timestamp", { ascending: false });

    for (const row of records || []) {
      if (!lastByStaff.has(row.staff_id)) {
        lastByStaff.set(row.staff_id, row.type as string);
      }
    }
  }

  const withStatus = staff.map((s) => {
    const lastType = lastByStaff.get(s.id) ?? null;
    return {
      ...s,
      lastType,
      nextAttempt: nextAttemptFromLast(lastType),
    };
  });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const filtered =
    mode === "check_in" || mode === "check_out"
      ? withStatus.filter((s) => s.nextAttempt === mode)
      : withStatus;

  return NextResponse.json({ staff: filtered });
}
