import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";

export async function GET() {
  const session = await getKioskSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, department, employee_code")
    .eq("organization_id", session.organizationId)
    .eq("role", "staff")
    .eq("is_active", true)
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data || [] });
}
