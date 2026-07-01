import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";

export async function POST(request: Request) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const path = `${session.organizationId}/${session.kioskId}/${Date.now()}.webm`;
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("kiosk-liveness-clips").upload(path, buffer, {
      contentType: file.type || "video/webm",
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
