import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { processKioskClock } from "@/lib/kiosk/process-clock";
import { isValidFaceDescriptor } from "@/lib/utils/faceMatch";

const bodySchema = z.object({
  staffId: z.string().uuid(),
  attemptType: z.enum(["check_in", "check_out"]),
  frameDescriptors: z.array(z.array(z.number())).min(1),
  liveDescriptor: z.array(z.number()).length(128),
  livenessClipUrl: z.string().optional(),
  liveCaptureUrl: z.string().optional(),
  frameMetadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid clock payload" }, { status: 400 });
    }

    if (!isValidFaceDescriptor(parsed.data.liveDescriptor)) {
      return NextResponse.json({ error: "Invalid face descriptor" }, { status: 400 });
    }

    const result = await processKioskClock({
      session,
      staffId: parsed.data.staffId,
      attemptType: parsed.data.attemptType,
      frameDescriptors: parsed.data.frameDescriptors,
      liveDescriptor: parsed.data.liveDescriptor,
      livenessClipUrl: parsed.data.livenessClipUrl,
      liveCaptureUrl: parsed.data.liveCaptureUrl,
      frameMetadata: parsed.data.frameMetadata,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clock failed" },
      { status: 500 }
    );
  }
}
