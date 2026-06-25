import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_PATH } from "@/constants";

const ADMIN_ROUTES = [
  "/dashboard",
  "/staff",
  "/attendance",
  "/leaves",
  "/reports",
  "/settings",
];

const STAFF_ROUTES = ["/my-attendance"];
const SHARED_ROUTES = ["/profile", "/my-leaves"];
const PUBLIC_ROUTES = ["/", AUTH_PATH, "/login", "/register", "/terms", "/privacy"];
const AUTH_SUBROUTES = ["/auth/reset-password"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) || AUTH_SUBROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute =
    pathname === AUTH_PATH || pathname === "/login" || pathname === "/register";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_PATH;
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role) {
      const url = request.nextUrl.clone();
      url.pathname =
        profile.role === "admin" ? "/dashboard" : "/my-attendance";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_PATH;
      url.searchParams.set("error", "profile-not-found");
      return NextResponse.redirect(url);
    }

    const role = profile.role;

    if (SHARED_ROUTES.some((r) => pathname.startsWith(r))) {
      return supabaseResponse;
    }

    if (role === "staff" && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
      const url = request.nextUrl.clone();
      url.pathname = "/my-attendance";
      return NextResponse.redirect(url);
    }

    if (role === "admin" && STAFF_ROUTES.some((r) => pathname.startsWith(r))) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    if (!user) {
      url.pathname = AUTH_PATH;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      url.pathname =
        profile?.role === "admin" ? "/dashboard" : "/my-attendance";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
