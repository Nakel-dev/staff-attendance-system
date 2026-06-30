import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/auth/reset-password";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=reset-link-invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=reset-link-invalid`);
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/auth/reset-password";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
