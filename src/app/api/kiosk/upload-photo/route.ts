import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const staffId = formData.get("staffId");

    if (!(file instanceof File) || typeof staffId !== "string" || !staffId) {
      return NextResponse.json({ error: "Missing file or staffId" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo too large (max 5MB)" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("id", staffId)
      .maybeSingle();

    if (!staff || staff.organization_id !== session.organizationId) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${session.organizationId}/${session.kioskId}/${staffId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage.from("kiosk-attendance-photos").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
