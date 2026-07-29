import { NextResponse } from "next/server";
import { z } from "zod";
import { getKioskSessionFromCookies } from "@/lib/kiosk/session";
import { processKioskDiditClock } from "@/lib/kiosk/face-clock";

const bodySchema = z.object({
  staffId: z.string().uuid(),
  attemptType: z.enum(["check_in", "check_out"]),
  diditSessionId: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const session = await getKioskSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Invalid kiosk session" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await processKioskDiditClock({
      session,
      ...parsed.data,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Didit clock failed" },
      { status: 500 }
    );
  }
}
