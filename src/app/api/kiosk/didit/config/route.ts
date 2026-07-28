import { NextResponse } from "next/server";

/** Report whether Didit face clock-in is enabled on this deployment. */
export async function GET() {
  const configured = Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID);
  return NextResponse.json({ configured });
}
