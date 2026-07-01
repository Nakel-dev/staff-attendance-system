import { AUTH_PATH } from "@/constants";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL(AUTH_PATH, request.url);
  return NextResponse.redirect(url);
}
