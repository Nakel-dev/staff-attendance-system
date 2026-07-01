import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { processKioskClock } from "@/lib/kiosk/process-clock";
import { isValidKioskPin } from "@/lib/kiosk/pin";

const bodySchema = z.object({
  staffId: z.string().uuid(),
  attemptType: z.enum(["check_in", "check_out"]),
  pin: z.string(),
  photoCaptureUrl: z.string().optional(),
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

    if (!isValidKioskPin(parsed.data.pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }

    const result = await processKioskClock({
      session,
      staffId: parsed.data.staffId,
      attemptType: parsed.data.attemptType,
      pin: parsed.data.pin,
      photoCaptureUrl: parsed.data.photoCaptureUrl,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clock failed" },
      { status: 500 }
    );
  }
}
