import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { processKioskFaceClock } from "@/lib/kiosk/face-clock";

const fieldsSchema = z.object({
  staffId: z.string().uuid().optional(),
  employeeCode: z.string().min(1).optional(),
  attemptType: z.enum(["check_in", "check_out"]),
});

/** Kiosk: staff ID + 3s video → Face++ auto clock (no admin review). */
export async function POST(request: Request) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
    }

    const form = await request.formData();
    const staffId = form.get("staffId");
    const employeeCode = form.get("employeeCode");
    const attemptType = form.get("attemptType");
    const file = form.get("file");
    const snapshot = form.get("snapshot");

    const parsed = fieldsSchema.safeParse({
      staffId: typeof staffId === "string" && staffId ? staffId : undefined,
      employeeCode: typeof employeeCode === "string" && employeeCode ? employeeCode : undefined,
      attemptType,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid clock payload" }, { status: 400 });
    }
    if (!parsed.data.staffId && !parsed.data.employeeCode) {
      return NextResponse.json({ error: "Staff ID or employee code required" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size < 1000) {
      return NextResponse.json({ error: "Missing verification video" }, { status: 400 });
    }
    if (!(snapshot instanceof File) || snapshot.size < 500) {
      return NextResponse.json({ error: "Missing face snapshot" }, { status: 400 });
    }

    const stamp = Date.now();
    const videoPath = `${session.organizationId}/${session.kioskId}/${stamp}.webm`;
    const snapshotPath = `${session.organizationId}/${session.kioskId}/${stamp}.jpg`;

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const videoBuffer = Buffer.from(await file.arrayBuffer());
    const { error: videoError } = await admin.storage
      .from("kiosk-liveness-clips")
      .upload(videoPath, videoBuffer, { contentType: file.type || "video/webm" });
    if (videoError) {
      return NextResponse.json({ error: videoError.message }, { status: 500 });
    }

    const snapBuffer = Buffer.from(await snapshot.arrayBuffer());
    const { error: snapError } = await admin.storage
      .from("kiosk-attendance-photos")
      .upload(snapshotPath, snapBuffer, { contentType: snapshot.type || "image/jpeg" });
    if (snapError) {
      return NextResponse.json({ error: snapError.message }, { status: 500 });
    }

    const result = await processKioskFaceClock({
      session,
      staffId: parsed.data.staffId,
      employeeCode: parsed.data.employeeCode,
      attemptType: parsed.data.attemptType,
      videoPath,
      snapshotPath,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clock failed" },
      { status: 500 }
    );
  }
}
