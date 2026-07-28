import { NextResponse } from "next/server";
import { getPhoneChallengePublic } from "@/lib/kiosk/phone-challenge";

/** Public: phone page loads challenge details (no login required). */
export async function GET(
  _request: Request,
  context: { params: { token: string } }
) {
  try {
    const { token } = context.params;
    const result = await getPhoneChallengePublic(token);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: typeof result.status === "number" ? result.status : 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load challenge" },
      { status: 500 }
    );
  }
}
