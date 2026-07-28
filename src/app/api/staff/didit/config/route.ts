import { NextResponse } from "next/server";
import { isDiditConfigured } from "@/lib/didit/client";

/** Whether Didit identity verification is available for the staff portal. */
export async function GET() {
  return NextResponse.json({ configured: isDiditConfigured() });
}
