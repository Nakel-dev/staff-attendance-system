import { NextResponse } from "next/server";
import { z } from "zod";
import { createKioskDevice, listKioskDevices } from "@/lib/actions/kiosk";
import { requireOrgAdminApi } from "@/lib/admin/require-org-admin";

export async function GET() {
  const auth = await requireOrgAdminApi();
  if ("error" in auth) return auth.error;

  const result = await listKioskDevices();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ kiosks: result.kiosks });
}

const createSchema = z.object({
  deviceName: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOrgAdminApi();
  if ("error" in auth) return auth.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await createKioskDevice(parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
