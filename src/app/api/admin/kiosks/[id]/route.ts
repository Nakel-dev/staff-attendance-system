import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteKioskDevice, toggleKioskDevice } from "@/lib/actions/kiosk";
import { requireOrgAdminApi } from "@/lib/admin/require-org-admin";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgAdminApi();
  if ("error" in auth) return auth.error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await toggleKioskDevice(params.id, parsed.data.isActive);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireOrgAdminApi();
  if ("error" in auth) return auth.error;

  const result = await deleteKioskDevice(params.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
